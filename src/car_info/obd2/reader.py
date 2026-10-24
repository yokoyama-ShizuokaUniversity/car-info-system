import threading
import time

import obd

from car_info import config
from car_info.state import State

# 毎回取得する項目(燃費計算・表示に必要なもの)
FAST_COMMANDS = [
    obd.commands.SPEED,
    obd.commands.RPM,
    obd.commands.MAF,
    obd.commands.ACCELERATOR_POS_D,
    obd.commands.THROTTLE_POS,
    obd.commands.ENGINE_LOAD,
    obd.commands.FUEL_STATUS,
]

# 1周ごとに1項目ずつ順番に取得する項目(変化がゆっくりなもの)
SLOW_COMMANDS = [
    obd.commands.COOLANT_TEMP,
    obd.commands.INTAKE_TEMP,
    obd.commands.INTAKE_PRESSURE,
    obd.commands.SHORT_FUEL_TRIM_1,
    obd.commands.LONG_FUEL_TRIM_1,
    obd.commands.O2_B1S1,
    obd.commands.O2_B1S2,
    obd.commands.TIMING_ADVANCE,
    obd.commands.CONTROL_MODULE_VOLTAGE,
    obd.commands.BAROMETRIC_PRESSURE,
    obd.commands.RUN_TIME,
    obd.commands.ACCELERATOR_POS_E,
    obd.commands.THROTTLE_POS_B,
    obd.commands.RELATIVE_THROTTLE_POS,
    obd.commands.THROTTLE_ACTUATOR,
    obd.commands.COMMANDED_EGR,
    obd.commands.EGR_ERROR,
    obd.commands.EVAPORATIVE_PURGE,
]


def to_plain(value):
    """python-OBDの値(単位付き)を、記録しやすい数値・文字列に変換する"""
    if hasattr(value, "magnitude"):
        return float(value.magnitude)
    return value


class ObdReader(threading.Thread):
    """OBDから値を取得し続け、stateに書き込むスレッド"""

    def __init__(self, state: State, on_cycle=None):
        super().__init__(daemon=True)
        self.state = state
        self.on_cycle = on_cycle  # 1周ごとに呼ぶ処理(燃費計算など)

    def connect(self):
        conn = obd.OBD(config.OBD_PORT, protocol=config.OBD_PROTOCOL,
                       baudrate=config.OBD_BAUDRATE)
        if conn.is_connected():
            return conn
        conn.close()
        return None

    def run(self):
        while True:
            conn = self.connect()
            if conn is None:
                self.state.update({"obd_status": "未接続"})
                time.sleep(5)
                continue

            # 車が対応している項目だけに絞る
            fast = [c for c in FAST_COMMANDS if conn.supports(c)]
            slow = [c for c in SLOW_COMMANDS if conn.supports(c)]
            i = 0

            while conn.is_connected():
                start = time.time()
                cmds = list(fast)
                if slow:
                    cmds.append(slow[i % len(slow)])
                    i += 1

                values = {cmd.name: to_plain(conn.query(cmd).value) for cmd in cmds}
                values["obd_status"] = "接続中"
                values["obd_time"] = time.time()
                values["obd_mono"] = time.monotonic()  # 時計が飛んでも狂わない取得時刻
                values["obd_cycle_sec"] = round(time.time() - start, 3)
                self.state.update(values)

                # 取得した直後の値で計算する(燃費など)
                if self.on_cycle:
                    self.state.update(self.on_cycle(self.state.snapshot()))

            conn.close()


def main():
    """単体テスト用:1秒ごとに最新値を表示する"""
    state = State()
    ObdReader(state).start()
    while True:
        time.sleep(1)
        print(state.snapshot())


if __name__ == "__main__":
    main()