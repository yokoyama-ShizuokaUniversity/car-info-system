import uvicorn

from car_info.obd2.fuel import FuelCalculator
from car_info.obd2.reader import ObdReader
from car_info.state import State
from car_info.web.server import create_app


def main():
    state = State()
    fuel = FuelCalculator()
    # OBDの値を取得した直後に、その値で燃費を計算する
    ObdReader(state, on_cycle=fuel.update).start()
    uvicorn.run(create_app(state), host="0.0.0.0", port=8000, log_level="warning")