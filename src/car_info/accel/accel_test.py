from smbus2 import SMBus
import time

ADDR = 0x1D
CTRL_REG1 = 0x2A
XYZ_DATA_CFG = 0x0E

def to_g(msb, lsb):
    v = ((msb << 8) | lsb) >> 4      # 12ビット(左詰め)
    if v > 2047:
        v -= 4096                     # 符号付きに変換
    return v / 1024.0                 # ±2gレンジ: 1024カウント = 1g

with SMBus(1) as bus:
    bus.write_byte_data(ADDR, CTRL_REG1, 0x00)     # スタンバイ(設定変更のため)
    bus.write_byte_data(ADDR, XYZ_DATA_CFG, 0x00)  # ±2g
    bus.write_byte_data(ADDR, CTRL_REG1, 0x25)     # 50Hz + 低ノイズ + 動作開始

    while True:
        d = bus.read_i2c_block_data(ADDR, 0x01, 6)
        x, y, z = to_g(d[0], d[1]), to_g(d[2], d[3]), to_g(d[4], d[5])
        print(f"X:{x:+.3f}  Y:{y:+.3f}  Z:{z:+.3f}")
        time.sleep(0.1)
