import os

# ELM327の接続設定
OBD_PORT = os.environ.get("CAR_OBD_PORT", "/dev/ttyACM0")
OBD_PROTOCOL = os.environ.get("CAR_OBD_PROTOCOL", "6") or None		# 6: CAN 11bit/500kbps
OBD_BAUDRATE = 38400
