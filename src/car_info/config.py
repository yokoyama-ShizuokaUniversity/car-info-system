import os
from pathlib import Path

# ELM327の接続設定
OBD_PORT = os.environ.get("CAR_OBD_PORT", "/dev/ttyACM0")
OBD_PROTOCOL = os.environ.get("CAR_OBD_PROTOCOL", "6") or None		# 6: CAN 11bit/500kbps
OBD_BAUDRATE = 38400

# GPS受信機の接続設定(環境変数で上書き可能)
GPS_PORT = os.environ.get("CAR_GPS_PORT", "/dev/serial0")
GPS_BAUD = 9600     # 受信機の通信速度
GPS_RATE_HZ = 5     # 1秒あたりの更新回数(9600bpsなら5回まで)

# 設定や走行データを保存する場所(環境変数で変更可)
DATA_DIR = Path(os.environ.get("CAR_DATA_DIR", "~/car-data")).expanduser()

# Webサーバーのポート(手動で起動するときは環境変数で 8000・8443 などに変更)
HTTP_PORT = int(os.environ.get("CAR_HTTP_PORT", "80"))
HTTPS_PORT = int(os.environ.get("CAR_HTTPS_PORT", "443"))

# HTTPSの証明書(なければHTTPだけで起動する)
TLS_CERT = DATA_DIR / "tls" / "cert.pem"
TLS_KEY = DATA_DIR / "tls" / "key.pem"

# GPSの時刻でシステム時刻を合わせる
CLOCK_SYNC_FROM_GPS = True

# 走行データの記録
LOG_DIR = Path(os.environ.get("CAR_LOG_DIR", str(DATA_DIR / "logs"))).expanduser()
LOG_DRIVING_HZ = 10     # 走行中の記録回数 [回/秒]
LOG_STOPPED_HZ = 1      # 停車中の記録回数 [回/秒]
LOG_STOP_HOLD_SEC = 3   # 車速0がこの秒数続いたら停車中とみなす
LOG_FLUSH_SEC = 5       # SDカードに書き込む間隔 [秒]
LOG_ROTATE_SEC = 3600   # ファイルを分ける間隔 [秒]
LOG_STALE_SEC = 10      # OBDの値がこの秒数更新されなければ記録を終える
LOG_MIN_FREE_MB = 500   # 空き容量がこれを下回ったら古いファイルから削除 [MB]

# アクセル開度の生の値の範囲(実車で計測:離したとき・踏み切ったとき)
ACCEL_RAW_MIN = 16.0
ACCEL_RAW_MAX = 66.0

# 加速度センサー(MMA8452Q)の接続設定
ACCEL_I2C_BUS = 1
ACCEL_I2C_ADDR = 0x1D
ACCEL_HZ = 50       # センサーを読む回数 [回/秒]
ACCEL_OUT_HZ = 10   # stateに書き込む回数 [回/秒](その間の平均を書き込む)
ACCEL_DEFAULT_FORWARD = (1.0, 0.0)  # 前方向を学習するまでの仮の前方向(センサーのX軸方向)
ACCEL_STILL_SEC = 3          # 停車中、この秒数揺れが小さければ重力の向きを学習する
ACCEL_STILL_TOL = 0.03       # 揺れが小さいとみなす範囲 [g]
ACCEL_GRAVITY_ALPHA = 0.2    # 2回目以降、重力の向きを1回で更新する割合(坂道で止まった影響を薄める)
ACCEL_FWD_SPAN_SEC = 1.0     # 前方向の学習で、車速の変化を比べる時間 [秒]
ACCEL_FWD_MIN_KMH = 10       # この車速未満では前方向を学習しない [km/h]
ACCEL_FWD_MIN_G = 0.08       # この加減速未満では前方向を学習しない [g]
ACCEL_FWD_LEARN_WEIGHT = 0.3 # 学習量がこれを超えたら前方向を学習済みとする
ACCEL_SAVE_SEC = 60          # 学習した補正値を保存する間隔 [秒]