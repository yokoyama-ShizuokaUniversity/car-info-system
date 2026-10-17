import asyncio
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from car_info.state import State

STATIC_DIR = Path(__file__).parent / "static"
PUSH_INTERVAL = 0.2  # ブラウザへ送る間隔 [秒]


def create_app(state: State) -> FastAPI:
    app = FastAPI()

    @app.get("/")
    def index():
        return FileResponse(STATIC_DIR / "index.html")
    
    @app.get("/v2")
    def index_v2():
        return FileResponse(STATIC_DIR / "v2" / "index.html")

    @app.get("/events")
    async def events():
        async def stream():
            while True:
                data = json.dumps(state.snapshot(), ensure_ascii=False, default=str)
                yield f"data: {data}\n\n"
                await asyncio.sleep(PUSH_INTERVAL)

        return StreamingResponse(stream(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache"})

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    return app