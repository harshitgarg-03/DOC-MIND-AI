import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.routers import upload, ask, documents
from app.core.database import Base, engine
from app.models import db_models  # noqa: F401 -- ensures models are registered on Base before create_all

from app.core.rate_limiter import limiter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(title="PDF Analyzer")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.on_event("startup")
def on_startup():
    # Creates any tables that don't exist yet (documents, chat_messages, etc.)
    # Safe to run every time -- create_all() skips tables that already exist.
    Base.metadata.create_all(bind=engine)
    logging.info("Database tables verified/created.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.exception(f"Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


app.mount("/files", StaticFiles(directory="uploaded_files"), name="files")

app.include_router(upload.router)
app.include_router(ask.router)
app.include_router(documents.router)


@app.get("/health")
def health():
    return {"status": "ok"}