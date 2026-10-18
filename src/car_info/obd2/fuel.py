import time

from car_info.obd2.reader import ObdReader
from car_info.state import State

STOICH_AFR = 14.7          # 理論空燃比(通常走行時)
RICH_AFR = 12.5            # 高負荷・冷間時の空燃比(推定)
FUEL_DENSITY = 745.0       # ガソリンの密度 [g/L]
ACCEL_RELEASED_MAX = 20.0  # アクセル開度がこれ以下なら「踏んでいない」とみなす [%](実車で要調整)
LOAD_RELEASED_MAX = 20.0   # アクセル開度が取れないときの代わり:エンジン負荷 [%]
KMPL_MAX = 99.9            # 瞬間燃費の上限(燃料カット中など)
MAX_GAP_SEC = 10           # これ以上データが空いたら積算しない [秒]


def judge_mode(snap: dict) -> str:
    """燃料の状態を判定する: normal(通常) / rich(濃い) / fuel_cut(燃料カット)"""
    status = (snap.get("FUEL_STATUS") or ("",))[0].lower()

    if "insufficient engine temperature" in status:
        return "rich"  # 冷間時
    if "fuel cut" in status:
        accel = snap.get("ACCELERATOR_POS_D")
        if accel is not None:
            released = accel <= ACCEL_RELEASED_MAX
        else:
            released = (snap.get("ENGINE_LOAD") or 0) <= LOAD_RELEASED_MAX
        return "fuel_cut" if released else "rich"
    return "normal"


def calc_instant(snap: dict) -> dict:
    """その瞬間の燃料消費量と瞬間燃費を計算する"""
    speed = snap.get("SPEED")
    maf = snap.get("MAF")
    if speed is None or maf is None:
        return {}

    mode = judge_mode(snap)
    if mode == "fuel_cut":
        fuel_gps = 0.0
    elif mode == "rich":
        fuel_gps = maf / RICH_AFR
    else:
        trim = (snap.get("SHORT_FUEL_TRIM_1") or 0) + (snap.get("LONG_FUEL_TRIM_1") or 0)
        fuel_gps = maf / STOICH_AFR * (1 + trim / 100)

    fuel_lph = fuel_gps * 3600 / FUEL_DENSITY

    if speed < 1:
        kmpl = None  # 停車中
    elif fuel_lph <= 0:
        kmpl = KMPL_MAX
    else:
        kmpl = min(speed / fuel_lph, KMPL_MAX)

    return {
        "fuel_mode": mode,
        "fuel_lph": round(fuel_lph, 3),
        "fuel_kmpl": None if kmpl is None else round(kmpl, 1),
    }

class FuelCalculator:
    """瞬間燃費の計算と、距離・燃料・燃料費の積算"""

    def __init__(self, price_of=None):
        self.price_of = price_of  # 現在のガソリン単価 [円/L] を返す関数(未設定なら None)
        self.last_time = None
        self.trip_km = 0.0
        self.trip_fuel_l = 0.0
        self.trip_cost = 0.0

    def update(self, snap: dict) -> dict:
        result = calc_instant(snap)
        t = snap.get("obd_mono", snap.get("obd_time"))
        if not result or t is None:
            return result

        price = self.price_of() if self.price_of else None

        # 前回からの経過時間ぶん、距離・燃料・燃料費を積算(同じデータの二重計算は避ける)
        if self.last_time is not None and 0 < t - self.last_time <= MAX_GAP_SEC:
            dt_h = (t - self.last_time) / 3600
            fuel_l = result["fuel_lph"] * dt_h
            self.trip_km += snap["SPEED"] * dt_h
            self.trip_fuel_l += fuel_l
            if price:
                self.trip_cost += fuel_l * price  # その時点の単価で積み上げる
        self.last_time = t

        result["trip_km"] = round(self.trip_km, 3)
        result["trip_fuel_l"] = round(self.trip_fuel_l, 4)
        result["trip_kmpl"] = (round(self.trip_km / self.trip_fuel_l, 1)
                               if self.trip_fuel_l > 0 else None)
        result["fuel_price"] = price
        result["trip_cost_yen"] = round(self.trip_cost, 1) if price else None
        result["cost_per_km"] = (round(self.trip_cost / self.trip_km, 2)
                                 if price and self.trip_km > 0.1 else None)
        return result

def main():
    """単体テスト用:1秒ごとに燃費の計算結果を表示する"""
    state = State()
    ObdReader(state).start()
    calc = FuelCalculator()
    while True:
        time.sleep(1)
        print(calc.update(state.snapshot()))


if __name__ == "__main__":
    main()
