import threading
import time
from datetime import datetime, timezone

import pynmea2
import serial

from car_info import config
from car_info.state import State

KNOT_TO_KMH = 1.852  # ノット → km/h


def nmea_sentence(body: str) -> str:
    """先頭の '$' と末尾の '*チェックサム' を付けたNMEAの文を作る"""
    checksum = 0
    for ch in body:
        checksum ^= ord(ch)
    return f"${body}*{checksum:02X}"

def set_system_clock(gps_iso: str) -> bool:
    """システム時刻をGPS時刻に設定する"""
    try:
        time.clock_settime(time.CLOCK_REALTIME, datetime.fromisoformat(gps_iso).timestamp())
    except PermissionError:
        print("時刻を変更する権限がないため、システム時刻は設定しません", flush=True)
        return False
    print(f"システム時刻をGPS時刻に設定しました: {gps_iso}", flush=True)
    return True

def to_int(text):
    """NMEAの数値(空欄はNone)"""
    try:
        return int(text)
    except (TypeError, ValueError):
        return None


class SkyCollector:
    """衛星の位置・信号強度(GSV)と、測位に使った衛星(GSA)をまとめて、衛星の一覧を作る"""

    GSA_GAP_SEC = 0.5  # GSAがこの秒数以上空いたら、次の回の始まりとみなす

    def __init__(self):
        self.pending = {}   # 受信途中のGSV(衛星の種類ごと)
        self.sky = {}       # 受信し終えたGSV(衛星の種類ごと)
        self.used = set()   # 測位に使っている衛星の番号
        self.used_next = set()
        self.last_gsa = 0.0

    def feed_gsa(self, msg, now: float):
        # 1回の測位で複数のGSA(衛星の種類ごと)が続けて届くので、まとめてから入れ替える
        if now - self.last_gsa > self.GSA_GAP_SEC:
            self.used = self.used_next
            self.used_next = set()
        self.last_gsa = now
        for i in range(1, 13):
            prn = to_int(getattr(msg, f"sv_id{i:02d}", None))
            if prn is not None:
                self.used_next.add(prn)

    def feed_gsv(self, msg) -> bool:
        """GSVを1文受け取る。衛星の種類1つ分を受け取り終えたらTrue"""
        talker = msg.talker
        if to_int(msg.msg_num) == 1:
            self.pending[talker] = []
        sats = self.pending.setdefault(talker, [])
        for i in range(1, 5):
            prn = to_int(getattr(msg, f"sv_prn_num_{i}", None))
            if prn is None:
                continue
            sats.append({
                "prn": prn,
                "elev": to_int(getattr(msg, f"elevation_deg_{i}", None)),  # 仰角 [°]
                "az": to_int(getattr(msg, f"azimuth_{i}", None)),          # 方位角 [°]
                "snr": to_int(getattr(msg, f"snr_{i}", None)),             # 信号強度 [dB-Hz]
            })
        if to_int(msg.msg_num) == to_int(msg.num_messages):
            self.sky[talker] = self.pending.pop(talker)
            return True
        return False

    def satellites(self) -> list:
        used = self.used | self.used_next
        sats = [dict(s, used=s["prn"] in used) for group in self.sky.values() for s in group]
        return sorted(sats, key=lambda s: s["prn"])


def parse_line(line: str, sky: SkyCollector | None = None) -> dict:
    """NMEAの1行を読み取り、stateに書き込む値を返す(対象外の行は空の辞書)"""
    try:
        msg = pynmea2.parse(line, check=True)
    except (pynmea2.ParseError, ValueError):
        return {}

    kind = getattr(msg, "sentence_type", None)  # 受信機独自の文($PMTK...)には種類がない

    # 衛星の一覧(GSV・GSA)は、何文かそろってから書き込む
    if sky is not None and kind == "GSA":
        sky.feed_gsa(msg, time.monotonic())
        return {}
    if sky is not None and kind == "GSV":
        if sky.feed_gsv(msg):
            return {"gps_sky": sky.satellites()}
        return {}

    if kind == "RMC":
        if msg.status != "A":  # A:測位中 / V:測位できていない
            return {"gps_fix": False}
        values = {
            "gps_fix": True,
            "gps_lat": round(msg.latitude, 6),
            "gps_lon": round(msg.longitude, 6),
            "gps_speed": round(float(msg.spd_over_grnd or 0) * KNOT_TO_KMH, 1),
            "gps_course": float(msg.true_course) if msg.true_course else None,
        }
        if msg.datestamp and msg.timestamp:
            values["gps_time"] = msg.datetime.replace(tzinfo=timezone.utc).isoformat()
        return values

    if kind == "GGA":
        return {
            "gps_sats": int(msg.num_sats or 0),
            "gps_hdop": float(msg.horizontal_dil) if msg.horizontal_dil else None,
            "gps_alt": float(msg.altitude) if msg.altitude is not None else None,
        }

    return {}


class GnssReader(threading.Thread):
    """GPS受信機からNMEAを読み続け、stateに書き込むスレッド"""

    def __init__(self, state: State):
        super().__init__(daemon=True)
        self.state = state
        self.clock_done = False # 起動後にシステム時刻を設定したか
        self.sky = SkyCollector()  # 衛星の一覧

    def setup(self, ser: serial.Serial):
        """受信機の設定:RMCとGGAだけを出力し、更新回数を上げる"""
        commands = [
            # 出力する文と回数:RMCは毎回、GGA・GSA・GSVは数回に1回(通信量を抑えるため)
            "PMTK314,0,1,0,{n},{n},{n},0,0,0,0,0,0,0,0,0,0,0,0,0".format(n=config.GPS_SLOW_EVERY),
            f"PMTK220,{int(1000 / config.GPS_RATE_HZ)}",      # 更新間隔 [ミリ秒]
        ]
        for body in commands:
            ser.write((nmea_sentence(body) + "\r\n").encode("ascii"))
            time.sleep(0.1)

    def run(self):
        while True:
            try:
                with serial.Serial(config.GPS_PORT, config.GPS_BAUD, timeout=2) as ser:
                    self.setup(ser)
                    while True:
                        line = ser.readline().decode("ascii", errors="ignore").strip()
                        if not line:
                            # 2秒間なにも届かない(受信機が外れている など)
                            self.state.update({"gps_status": "受信なし", "gps_fix": False})
                            continue
                        values = parse_line(line, self.sky)
                        if values:
                            values["gps_status"] = "受信中"
                            values["gps_rx_time"] = time.time()
                            values["gps_rx_mono"] = time.monotonic()  # 時計が飛んでも狂わない受信時刻
                            if config.CLOCK_SYNC_FROM_GPS and not self.clock_done and values.get("gps_time"):
                                set_system_clock(values["gps_time"])
                                self.clock_done = True  # 成功・失敗にかかわらず、試すのは1回だけ
                            self.state.update(values)
            except serial.SerialException:
                self.state.update({"gps_status": "未接続", "gps_fix": False})
                time.sleep(5)
                
            except Exception as e:
                # 想定外のエラーでもスレッドを止めず、内容を表示して再試行する
                print(f"GPS読み取りエラー: {e!r}", flush=True)
                self.state.update({"gps_status": "エラー", "gps_fix": False})
                time.sleep(5)