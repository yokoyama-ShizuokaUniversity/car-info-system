import asyncio

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse

from car_info import config
from car_info.gnss.reader import GnssReader
from car_info.obd2.fuel import FuelCalculator
from car_info.obd2.reader import ObdReader
from car_info.settings_store import SettingsStore
from car_info.state import State
from car_info.web.server import create_app
from car_info.recorder import DataRecorder

def redirect_app() -> FastAPI:
    """HTTPで来たアクセスを、HTTPSの同じページへ転送する"""
    app = FastAPI()

    @app.get("/{path:path}")
    def to_https(request: Request, path: str):
        port = "" if config.HTTPS_PORT == 443 else f":{config.HTTPS_PORT}"
        return RedirectResponse(f"https://{request.url.hostname}{port}/{path}")

    return app


def serve(app: FastAPI):
    """Webサーバーを起動する(証明書があればHTTPS+転送、なければHTTPのみ)"""
    servers = []
    if config.TLS_CERT.exists() and config.TLS_KEY.exists():
        servers.append(uvicorn.Server(uvicorn.Config(
            app, host="0.0.0.0", port=config.HTTPS_PORT, log_level="warning",
            ssl_certfile=str(config.TLS_CERT), ssl_keyfile=str(config.TLS_KEY))))
        servers.append(uvicorn.Server(uvicorn.Config(
            redirect_app(), host="0.0.0.0", port=config.HTTP_PORT, log_level="warning")))
    else:
        print("証明書がないため、HTTPのみで起動します", flush=True)
        servers.append(uvicorn.Server(uvicorn.Config(
            app, host="0.0.0.0", port=config.HTTP_PORT, log_level="warning")))

    async def run_all():
        await asyncio.gather(*(server.serve() for server in servers))

    asyncio.run(run_all())


def main():
    state = State()
    store = SettingsStore(config.DATA_DIR / "settings.json")
    state.update({"fuel_price": store.get("fuel_price")})

    # OBDの値を取得した直後に、その値で燃費・燃料費を計算する
    fuel = FuelCalculator(price_of=lambda: store.get("fuel_price"))
    ObdReader(state, on_cycle=fuel.update).start()
    GnssReader(state).start()
    DataRecorder(state).start()

    # Webサーバーの起動は最後に(ここでプログラムが動き続け、次の行には進まない)
    serve(create_app(state, store))