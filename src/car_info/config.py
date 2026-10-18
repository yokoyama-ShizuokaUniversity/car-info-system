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