import json
import math
import threading
import time
from collections import deque

from car_info import config
from car_info.state import State

G = 9.80665  # 重力加速度 [m/s²]


# ---- ベクトル計算(Pi 3でnumpyのビルドを避けるため、標準ライブラリだけで書く) ----
def norm(v) -> float:
    return math.sqrt(sum(c * c for c in v))

def unit(v) -> list:
    n = norm(v)
    return [c / n for c in v] if n > 0 else list(v)

def mat_vec(R, v) -> list:
    return [sum(R[i][j] * v[j] for j in range(3)) for i in range(3)]

def average(samples) -> list:
    """(x, y, z)の並びの平均"""
    n = len(samples)
    return [sum(s[i] for s in samples) / n for i in range(3)]

def align_to_z(a) -> list:
    """単位ベクトルaを真上(0,0,1)に向ける回転行列(ロドリゲスの公式)"""
    ax, ay, az = a
    if az < -0.999:  # ほぼ真下を向いている(センサーが裏返し)
        return [[1, 0, 0], [0, -1, 0], [0, 0, -1]]
    vx, vy = ay, -ax          # a × (0,0,1)
    k = 1.0 / (1.0 + az)      # 1 / (1 + a・(0,0,1))
    K = [[0, 0, vy], [0, 0, -vx], [-vy, vx, 0]]
    K2 = [[sum(K[i][m] * K[m][j] for m in range(3)) for j in range(3)] for i in range(3)]
    I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    return [[I[i][j] + K[i][j] + K2[i][j] * k for j in range(3)] for i in range(3)]


class Calibration:
    """取り付けの向きの補正値(重力の向き・前方向)を学習し、ファイルに保存する"""

    def __init__(self, path):
        self.path = path
        self.gravity = [0.0, 0.0, 1.0]  # センサーから見た「真上」の向き(停車中に学習)
        self.gravity_learned = False
        self.fwd_sum = [0.0, 0.0]       # 前方向を求めるための積算値(水平面上)
        self.fwd_weight = 0.0           # 積算した量(多いほど前方向が確か)
        self.load()
        self.R = align_to_z(self.gravity)

    def load(self):
        try:
            d = json.loads(self.path.read_text())
            self.gravity = unit(d["gravity"])
            self.gravity_learned = bool(d["gravity_learned"])
            self.fwd_sum = [float(v) for v in d["fwd_sum"]]
            self.fwd_weight = float(d["fwd_weight"])
        except (FileNotFoundError, KeyError, ValueError, TypeError):
            pass  # ファイルがない・壊れているときは初期値から学習し直す

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({
            "gravity": self.gravity,
            "gravity_learned": self.gravity_learned,
            "fwd_sum": self.fwd_sum,
            "fwd_weight": self.fwd_weight,
        }, indent=2))
        tmp.replace(self.path)  # 書き込み途中で電源が切れても壊れないように、最後に置き換える

    @property
    def forward_learned(self) -> bool:
        return self.fwd_weight >= config.ACCEL_FWD_LEARN_WEIGHT

    @property
    def status(self) -> str:
        if not self.gravity_learned:
            return "未補正"
        if not self.forward_learned:
            return "学習中"
        return "学習済み"

    @property
    def forward(self) -> list:
        """水平面上の前方向(学習するまでは設定の初期値)"""
        if self.forward_learned and norm(self.fwd_sum) > 0:
            return unit(self.fwd_sum)
        return unit(config.ACCEL_DEFAULT_FORWARD)

    def learn_gravity(self, mean):
        """停車中の平均値で、真上の向きを更新する(坂道で止まった影響を薄めるため少しずつ)"""
        if not self.gravity_learned:
            self.gravity = unit(mean)  # 初回はそのまま採用
            self.gravity_learned = True
        else:
            a = config.ACCEL_GRAVITY_ALPHA
            self.gravity = unit([(1 - a) * g + a * m for g, m in zip(self.gravity, unit(mean))])
        self.R = align_to_z(self.gravity)

    def learn_forward(self, horiz, a_obd):
        """OBDの車速変化(a_obd [g])と、同じ時間の水平方向の加速度(horiz)から前方向を積み上げる"""
        self.fwd_sum = [s + a_obd * h for s, h in zip(self.fwd_sum, horiz)]
        self.fwd_weight += a_obd * a_obd

    def horizontal(self, raw) -> tuple[float, float, float]:
        """センサーの値を、真上がZになるように回転させる"""
        x, y, z = mat_vec(self.R, raw)
        return x, y, z

    def to_vehicle(self, raw) -> tuple[float, float, float]:
        """センサーの値 → (前後G, 左右G, 上下G)。前後は加速が+、左右は右向きが+"""
        x, y, z = self.horizontal(raw)
        fx, fy = self.forward
        longi = x * fx + y * fy
        lat = x * fy - y * fx  # 右方向 = 前方向 × 真上
        return longi, lat, z - 1.0  # 上下は重力の1gを除く


class AccelReader(threading.Thread):
    """加速度センサーを読み続け、前後G・左右Gをstateに書き込むスレッド"""

    def __init__(self, state: State):
        super().__init__(daemon=True)
        self.state = state
        self.calib = Calibration(config.DATA_DIR / "accel_calib.json")
        self.still = []        # 停車中の値(重力の向きの学習用)
        self.window = deque()  # 直近の水平方向の加速度 (時刻, x, y)(前方向の学習用)
        self.speeds = deque()  # 直近のOBD車速 (時刻, km/h)
        self.dirty = False     # 保存していない学習結果があるか
        self.last_save = time.monotonic()

    def run(self):
        # smbus2が入っていない環境(Macなど)でも、ほかの機能は動かす
        from car_info.accel.mma8452 import MMA8452

        while True:
            try:
                sensor = MMA8452(config.ACCEL_I2C_BUS, config.ACCEL_I2C_ADDR)
            except Exception:
                self.state.update({"accel_status": "未接続"})
                time.sleep(5)
                continue

            try:
                self.loop(sensor)
            except Exception as e:
                # 想定外のエラーでもスレッドを止めず、内容を表示して再試行する
                print(f"加速度センサー読み取りエラー: {e!r}", flush=True)
                self.state.update({"accel_status": "エラー"})
                sensor.close()
                time.sleep(5)

    def loop(self, sensor):
        period = 1.0 / config.ACCEL_HZ
        per_out = max(1, config.ACCEL_HZ // config.ACCEL_OUT_HZ)  # 何回分を平均して書き込むか
        buf = []
        next_t = time.monotonic()

        while True:
            buf.append(sensor.read())

            if len(buf) >= per_out:
                raw = average(buf)
                buf.clear()
                now = time.monotonic()
                self.learn(raw, now)
                longi, lat, vert = self.calib.to_vehicle(raw)
                self.state.update({
                    "accel_status": "受信中",
                    "accel_calib": self.calib.status,
                    "accel_long": round(longi, 3),   # 前後G(加速+ / 減速−)
                    "accel_lat": round(lat, 3),      # 左右G(右+ / 左−)
                    "accel_vert": round(vert, 3),    # 上下G(重力を除いた分)
                    "accel_raw_x": round(raw[0], 3),
                    "accel_raw_y": round(raw[1], 3),
                    "accel_raw_z": round(raw[2], 3),
                })
                self.save_if_needed(now)

            # 一定間隔で読む(処理が遅れた分は次の待ち時間で吸収する)
            next_t += period
            wait = next_t - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            elif wait < -1.0:  # 大きく遅れたら追いつこうとしない
                next_t = time.monotonic()

    def save_if_needed(self, now):
        if self.dirty and now - self.last_save >= config.ACCEL_SAVE_SEC:
            self.calib.save()
            self.dirty = False
            self.last_save = now

    def learn(self, raw, now):
        """停車中は重力の向き、加減速中は前方向を学習する"""
        snap = self.state.snapshot()
        speed = snap.get("SPEED")
        if speed is None or snap.get("obd_status") != "接続中":
            # 車速が分からないときは学習しない
            self.still.clear()
            self.window.clear()
            self.speeds.clear()
            return

        before = self.calib.status
        self.learn_gravity(raw, speed)
        self.learn_forward(raw, speed, now)
        if self.calib.status != before:
            self.last_save = 0.0  # 状態が変わったら、すぐに保存する

    def learn_gravity(self, raw, speed):
        """停車中、揺れが小さい状態が続いたら、真上の向きを更新する"""
        if speed != 0:
            self.still.clear()
            return
        self.still.append(raw)
        if len(self.still) < config.ACCEL_OUT_HZ * config.ACCEL_STILL_SEC:
            return
        avg = average(self.still)
        spread = max(abs(v[i] - avg[i]) for v in self.still for i in range(3))
        if spread < config.ACCEL_STILL_TOL:
            self.calib.learn_gravity(avg)
            self.dirty = True
        self.still.clear()

    def learn_forward(self, raw, speed, now):
        """OBDの車速の変化と、同じ時間の水平方向の加速度を比べて、前方向を学習する"""
        if not self.calib.gravity_learned:
            return  # 真上が分からないうちは、水平方向も分からない
        x, y, _ = self.calib.horizontal(raw)
        self.window.append((now, x, y))
        self.speeds.append((now, speed))

        span = config.ACCEL_FWD_SPAN_SEC
        while now - self.window[0][0] > span:
            self.window.popleft()
        while now - self.speeds[0][0] > span:
            self.speeds.popleft()

        t0, v0 = self.speeds[0]
        if now - t0 < span * 0.8 or min(speed, v0) < config.ACCEL_FWD_MIN_KMH:
            return
        a_obd = (speed - v0) / 3.6 / (now - t0) / G  # 車速の変化から求めた前後の加速度 [g]
        if abs(a_obd) < config.ACCEL_FWD_MIN_G:
            return
        hx = sum(w[1] for w in self.window) / len(self.window)
        hy = sum(w[2] for w in self.window) / len(self.window)
        self.calib.learn_forward((hx, hy), a_obd)
        self.dirty = True
        self.window.clear()  # 同じ区間を何度も数えない
        self.speeds.clear()