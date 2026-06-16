from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import video, lyrics

app = FastAPI(title="SPlus がな API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video.router, prefix="/api")
app.include_router(lyrics.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
