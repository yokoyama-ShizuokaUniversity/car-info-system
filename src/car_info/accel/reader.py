import threading
import time

from car_info import config
from car_info.state import State


def average(samples: list) -> list:
    """(x, y, z)のリストの平均"""
    n = len(samples)
    return [sum(s[i] for s in samples) / n for i in range(3)]


def to_vehicle(raw: list) -> tuple[float, float, float]:
    """センサーの値 → (前後G, 左右G, 上下G)。補正を入れるまではX・Y・Zをそのまま使う"""
    x, y, z = raw
    return x, y, z - 1.0  # 上下は重力の1gを除く


class AccelReader(threading.Thread):
    """加速度センサーを読み続け、stateに書き込むスレッド"""

    def __init__(self, state: State):
        super().__init__(daemon=True)
        self.state = state

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
                longi, lat, vert = to_vehicle(raw)
                self.state.update({
                    "accel_status": "受信中",
                    "accel_calib": "未補正",
                    "accel_long": round(longi, 3),   # 前後G(加速+ / 減速−)
                    "accel_lat": round(lat, 3),      # 左右G(右+ / 左−)
                    "accel_vert": round(vert, 3),    # 上下G(重力を除いた分)
                    "accel_raw_x": round(raw[0], 3),
                    "accel_raw_y": round(raw[1], 3),
                    "accel_raw_z": round(raw[2], 3),
                })

            # 一定間隔で読む(処理が遅れた分は次の待ち時間で吸収する)
            next_t += period
            wait = next_t - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            elif wait < -1.0:  # 大きく遅れたら追いつこうとしない
                next_t = time.monotonic()