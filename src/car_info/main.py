import uvicorn

from car_info import config
from car_info.gnss.reader import GnssReader
from car_info.obd2.fuel import FuelCalculator
from car_info.obd2.reader import ObdReader
from car_info.settings_store import SettingsStore
from car_info.state import State
from car_info.web.server import create_app


def main():
    state = State()
    store = SettingsStore(config.DATA_DIR / "settings.json")
    state.update({"fuel_price": store.get("fuel_price")})

    # OBDの値を取得した直後に、その値で燃費・燃料費を計算する
    fuel = FuelCalculator(price_of=lambda: store.get("fuel_price"))
    ObdReader(state, on_cycle=fuel.update).start()
    GnssReader(state).start()

    # Webサーバーの起動は最後に(ここでプログラムが動き続け、次の行には進まない)
    uvicorn.run(create_app(state, store), host="0.0.0.0", port=8000, log_level="warning")