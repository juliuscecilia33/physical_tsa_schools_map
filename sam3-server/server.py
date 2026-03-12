import os
import ssl
import certifi
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())

import uuid
import time
import threading
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

def _get_run_segmentation():
    from segmenter import run_segmentation
    return run_segmentation

app = FastAPI(title="SAM3 Segmentation Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------

jobs: dict[str, dict] = {}
_lock = threading.Lock()


class SegmentRequest(BaseModel):
    bbox: list[float] = Field(..., min_length=4, max_length=4, description="[west, south, east, north]")
    prompt: str = Field(..., min_length=1, max_length=200)
    zoom: int = Field(default=18, ge=14, le=20)
    box_threshold: float = Field(default=0.24, ge=0.0, le=1.0)
    text_threshold: float = Field(default=0.24, ge=0.0, le=1.0)


class SegmentResponse(BaseModel):
    job_id: str


class JobStatus(BaseModel):
    status: str  # queued | processing | complete | error
    progress: float  # 0.0 - 1.0
    message: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    elapsed_seconds: Optional[float] = None


# ---------------------------------------------------------------------------
# Worker – runs one job at a time in a background thread
# ---------------------------------------------------------------------------

def _run_job(job_id: str, params: SegmentRequest):
    def progress_cb(msg: str, pct: float):
        with _lock:
            jobs[job_id]["status"] = "processing"
            jobs[job_id]["message"] = msg
            jobs[job_id]["progress"] = pct

    try:
        run_segmentation = _get_run_segmentation()
        result = run_segmentation(
            bbox=params.bbox,
            text_prompt=params.prompt,
            zoom=params.zoom,
            box_threshold=params.box_threshold,
            text_threshold=params.text_threshold,
            progress_callback=progress_cb,
        )
        with _lock:
            jobs[job_id]["status"] = "complete"
            jobs[job_id]["progress"] = 1.0
            jobs[job_id]["message"] = "Done!"
            jobs[job_id]["result"] = result
            jobs[job_id]["elapsed_seconds"] = time.time() - jobs[job_id]["start_time"]
    except Exception as exc:
        with _lock:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = str(exc)
            jobs[job_id]["elapsed_seconds"] = time.time() - jobs[job_id]["start_time"]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/segment", response_model=SegmentResponse)
def segment(req: SegmentRequest):
    job_id = str(uuid.uuid4())
    with _lock:
        jobs[job_id] = {
            "status": "queued",
            "progress": 0.0,
            "message": "Queued...",
            "result": None,
            "error": None,
            "start_time": time.time(),
            "elapsed_seconds": None,
        }
    thread = threading.Thread(target=_run_job, args=(job_id, req), daemon=True)
    thread.start()
    return SegmentResponse(job_id=job_id)


@app.get("/status/{job_id}", response_model=JobStatus)
def status(job_id: str):
    with _lock:
        job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(
        status=job["status"],
        progress=job["progress"],
        message=job.get("message"),
        result=job.get("result"),
        error=job.get("error"),
        elapsed_seconds=job.get("elapsed_seconds"),
    )
