from smbus2 import SMBus

CTRL_REG1 = 0x2A     # 動作モード・出力周期
XYZ_DATA_CFG = 0x0E  # 測定範囲
OUT_X_MSB = 0x01     # ここから6バイトがX・Y・Zの値
WHO_AM_I = 0x0D      # チップの識別番号
CHIP_ID = 0x2A       # MMA8452Qの識別番号


class MMA8452:
    """加速度センサー MMA8452Q(I2C)の読み取り"""

    def __init__(self, bus: int = 1, addr: int = 0x1D):
        self.addr = addr
        self.bus = SMBus(bus)
        if self.bus.read_byte_data(addr, WHO_AM_I) != CHIP_ID:
            self.bus.close()
            raise OSError("MMA8452Qが見つかりません")
        self.bus.write_byte_data(addr, CTRL_REG1, 0x00)     # スタンバイ(設定変更のため)
        self.bus.write_byte_data(addr, XYZ_DATA_CFG, 0x00)  # ±2g
        self.bus.write_byte_data(addr, CTRL_REG1, 0x25)     # 50Hz・低ノイズ・動作開始

    @staticmethod
    def _to_g(msb: int, lsb: int) -> float:
        v = ((msb << 8) | lsb) >> 4  # 12ビット(左詰め)
        if v > 2047:
            v -= 4096                # 符号付きに変換
        return v / 1024.0            # ±2gレンジ: 1024カウント = 1g

    def read(self) -> tuple[float, float, float]:
        """X・Y・Zの加速度 [g]"""
        d = self.bus.read_i2c_block_data(self.addr, OUT_X_MSB, 6)
        return (self._to_g(d[0], d[1]), self._to_g(d[2], d[3]), self._to_g(d[4], d[5]))

    def close(self):
        self.bus.close()