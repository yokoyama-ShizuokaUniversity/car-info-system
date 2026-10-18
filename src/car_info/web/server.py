import asyncio
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from car_info.state import State
from car_info.settings_store import SettingsStore

STATIC_DIR = Path(__file__).parent / "static"
PUSH_INTERVAL = 0.2  # ブラウザへ送る間隔 [秒]

class FuelPrice(BaseModel):
    price: float = Field(gt=0, lt=1000)  # ガソリン単価 [円/L]

def create_app(state: State, store: SettingsStore | None = None) -> FastAPI:
    app = FastAPI()
    
    @app.get("/")
    def index():
        return FileResponse(STATIC_DIR / "v2" / "index.html")

    @app.get("/v1")
    def index_v1():
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/events")
    async def events():
        async def stream():
            while True:
                data = json.dumps(state.snapshot(), ensure_ascii=False, default=str)
                yield f"data: {data}\n\n"
                await asyncio.sleep(PUSH_INTERVAL)

        return StreamingResponse(stream(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache"})
    
    @app.get("/api/settings")
    def get_settings():
        return store.all() if store else {}

    @app.post("/api/fuel-price")
    def set_fuel_price(body: FuelPrice):
        if store is None:
            raise HTTPException(503, "設定を保存できません")
        store.set("fuel_price", body.price)
        state.update({"fuel_price": body.price})
        return {"fuel_price": body.price}

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    return app