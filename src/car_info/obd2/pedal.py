from car_info import config


def calc_pedal(snap: dict) -> dict:
    """アクセル開度の生の値を、離した=0%・踏み切った=100%に換算する"""
    raw = snap.get("ACCELERATOR_POS_D")
    if raw is None:
        return {}
    pct = (raw - config.ACCEL_RAW_MIN) / (config.ACCEL_RAW_MAX - config.ACCEL_RAW_MIN) * 100
    return {"accel_pct": round(min(100.0, max(0.0, pct)), 1)}