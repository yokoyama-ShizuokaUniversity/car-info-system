import gzip
import json
import os
import shutil
import threading
import time
import zlib
from datetime import datetime
from pathlib import Path

from car_info import config
from car_info.state import State

# 記録しない項目(内部用の時刻や、別の名前で記録するもの)
EXCLUDE_KEYS = {"obd_time", "obd_mono", "gps_rx_time", "gps_rx_mono", "gps_time"}
GPS_FRESH_SEC = 1.0  # GPS時刻を受け取ってからこの秒数以内なら、その行の時刻として記録する
TICK_SEC = 0.05      # 記録するかを判断する間隔 [秒]


def build_row(snap: dict, elapsed: float, mode: str, now_mono: float) -> dict:
    """stateのスナップショットから、記録する1行を作る"""
    gps_fresh = bool(
        snap.get("gps_fix") and snap.get("gps_time")
        and snap.get("gps_rx_mono") is not None
        and now_mono - snap["gps_rx_mono"] <= GPS_FRESH_SEC
    )
    row = {
        "t_elapsed": round(elapsed, 3),  # 記録開始からの経過時間 [秒]
        "t_system": datetime.now().astimezone().isoformat(timespec="milliseconds"),
        "t_gps": snap["gps_time"] if gps_fresh else None,  # 取れないときは空
        "mode": mode,
    }
    row.update({k: v for k, v in snap.items() if k not in EXCLUDE_KEYS})
    return row


class ModeTracker:
    """走行中・停車中の判定(車速0が一定時間続いたら停車中、0でなくなったら即座に走行中)"""

    def __init__(self, hold_sec: float):
        self.hold_sec = hold_sec
        self.mode = "stopped"
        self.zero_since = None

    def update(self, speed, now: float) -> str:
        if speed is None:
            return self.mode
        if speed > 0:
            self.mode = "driving"
            self.zero_since = None
        else:
            if self.zero_since is None:
                self.zero_since = now
            if now - self.zero_since >= self.hold_sec:
                self.mode = "stopped"
        return self.mode


class LogFile:
    """gzipで圧縮しながら書くJSON Linesのファイル(電源が切れても、書き込み済みの部分は読める)"""

    def __init__(self, path: Path):
        self.path = path
        self._raw = open(path, "ab")
        self._gz = gzip.GzipFile(fileobj=self._raw, mode="ab")

    def write_rows(self, rows: list):
        for row in rows:
            line = json.dumps(row, ensure_ascii=False, separators=(",", ":"), default=str) + "\n"
            self._gz.write(line.encode("utf-8"))
        # 圧縮の区切りを入れてSDカードまで書き出す(ここまでのデータは電源断の後も読める)
        self._gz.flush(zlib.Z_SYNC_FLUSH)
        self._raw.flush()
        os.fsync(self._raw.fileno())

    def close(self):
        self._gz.close()
        self._raw.close()


def iter_rows(path):
    """記録ファイルを1行ずつ読む(電源断で途中までのファイルも、読めるところまで読む)"""
    with gzip.open(path, "rt", encoding="utf-8") as f:
        try:
            for line in f:
                if line.strip():
                    yield json.loads(line)
        except (EOFError, zlib.error, json.JSONDecodeError):
            return


def next_session_number(log_dir: Path) -> int:
    """記録の通し番号(システム時刻がずれていても、ファイルの順番が分かるように)"""
    counter = log_dir / "session.txt"
    try:
        n = int(counter.read_text()) + 1
    except (FileNotFoundError, ValueError):
        n = 1
    tmp = counter.with_suffix(".tmp")
    tmp.write_text(str(n))
    os.replace(tmp, counter)
    return n


def cleanup_old_logs(log_dir: Path, min_free_mb: float):
    """空き容量が少なければ、古い記録ファイルから削除する"""
    files = sorted(log_dir.glob("*.jsonl.gz"))  # 名前の先頭が通し番号なので、名前順=古い順
    while files and shutil.disk_usage(log_dir).free / 1024 ** 2 < min_free_mb:
        oldest = files.pop(0)
        oldest.unlink()
        print(f"空き容量が少ないため削除: {oldest.name}", flush=True)


class DataRecorder(threading.Thread):
    """OBDがつながっている間、走行中は細かく・停車中は粗く、全データを記録するスレッド"""

    def __init__(self, state: State):
        super().__init__(daemon=True)
        self.state = state
        self.log_dir = config.LOG_DIR
        self.file = None            # 記録中のファイル
        self.buffer = []            # まだ書き込んでいない行
        self.session = 0
        self.part = 0
        self.start_mono = 0.0       # 記録開始の時刻(経過時間の基準)
        self.part_start_mono = 0.0
        self.last_row_mono = 0.0
        self.last_flush_mono = 0.0
        self.last_obd_mono = None   # 最後に記録したOBDの取得時刻
        self.modes = ModeTracker(config.LOG_STOP_HOLD_SEC)

    def run(self):
        while True:
            try:
                self.tick()
            except Exception as e:
                # 想定外のエラーでもスレッドを止めず、ファイルを閉じてやり直す
                print(f"記録エラー: {e!r}", flush=True)
                self.close_session()
                time.sleep(5)
            time.sleep(TICK_SEC)

    def tick(self):
        snap = self.state.snapshot()
        now = time.monotonic()
        obd_mono = snap.get("obd_mono")
        connected = (snap.get("obd_status") == "接続中" and obd_mono is not None
                     and now - obd_mono <= config.LOG_STALE_SEC)

        # OBDの接続に合わせて記録を開始・終了
        if not connected:
            self.close_session()
            return
        if self.file is None:
            self.open_session(now)

        # 走行中は新しいOBDの値が来るたび(上限あり)、停車中は一定間隔で1行作る
        mode = self.modes.update(snap.get("SPEED"), now)
        hz = config.LOG_DRIVING_HZ if mode == "driving" else config.LOG_STOPPED_HZ
        new_data = obd_mono != self.last_obd_mono
        if now - self.last_row_mono >= 1 / hz and (new_data or mode == "stopped"):
            self.buffer.append(build_row(snap, now - self.start_mono, mode, now))
            self.last_row_mono = now
            self.last_obd_mono = obd_mono

        # 一定間隔でSDカードに書き込み、長くなったらファイルを分ける
        if now - self.last_flush_mono >= config.LOG_FLUSH_SEC:
            self.flush(now)
        if now - self.part_start_mono >= config.LOG_ROTATE_SEC:
            self.flush(now)
            self.file.close()
            self.open_part(now)

    def open_session(self, now: float):
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.session = next_session_number(self.log_dir)
        self.part = 0
        self.start_mono = now
        self.modes = ModeTracker(config.LOG_STOP_HOLD_SEC)
        self.open_part(now)

    def open_part(self, now: float):
        self.part += 1
        cleanup_old_logs(self.log_dir, config.LOG_MIN_FREE_MB)
        name = f"{self.session:05d}_{datetime.now():%Y%m%d_%H%M%S}_{self.part:02d}.jsonl.gz"
        self.file = LogFile(self.log_dir / name)
        self.part_start_mono = now
        self.last_flush_mono = now
        print(f"記録開始: {name}", flush=True)

    def flush(self, now: float):
        if self.file is not None and self.buffer:
            self.file.write_rows(self.buffer)
        self.buffer = []
        self.last_flush_mono = now

    def close_session(self):
        if self.file is None:
            return
        try:
            self.flush(time.monotonic())
            self.file.close()
            print(f"記録終了: {self.file.path.name}", flush=True)
        finally:
            self.file = None
            self.buffer = []