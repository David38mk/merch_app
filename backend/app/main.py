from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers import api_router
from app.core.config import settings

app = FastAPI(title="MyHappinessClub API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# 🔌 storage seam: serve locally-stored uploads. In prod these live on a CDN.
_upload_dir = Path(settings.UPLOAD_DIR)
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount(settings.UPLOAD_URL_PREFIX, StaticFiles(directory=_upload_dir), name="uploads")


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


@app.get("/", tags=["meta"])
def root() -> dict:
    return {"name": "MyHappinessClub API", "docs": "/docs"}
