from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv(Path(__file__).resolve().parent.parent / ".env")  # root .env
load_dotenv(Path(__file__).resolve().parent.parent / "server" / ".env")  # server .env (has OPENAI_API_KEY)
load_dotenv()                                                  # python/.env (overrides if present)

from services.floorplan_parser import parse_floorplan
from services.object_recognition import detect_objects, segment_room

app = FastAPI(title="Vision Studio AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    key = os.getenv("OPENAI_API_KEY") or ""
    configured = bool(key.strip()) and "your-" not in key.lower() and "placeholder" not in key.lower()
    return {
        "status": "ok",
        "service": "vision-studio-python",
        "openai_configured": configured,
        "preferred_parse_method": "openai_vision_grid_snap",
    }


@app.post("/parse-floorplan")
async def parse_floorplan_endpoint(file: UploadFile = File(...)):
    allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}. Upload a JPEG, PNG, WebP, or PDF.")
    contents = await file.read()
    result = await parse_floorplan(contents, file.content_type)
    return result


@app.post("/detect-objects")
async def detect_objects_endpoint(
    file: UploadFile = File(None),
    image_url: str = Form(None),
    labels: str = Form(
        default="sofa,chair,bed,desk,table,bookshelf,dresser,window,door"
    ),
):
    if not file and not image_url:
        raise HTTPException(400, "Provide either a file upload or image_url")
    label_list = [l.strip() for l in labels.split(",")]
    result = await detect_objects(image_url, label_list, file=file)
    return result


@app.post("/segment-room")
async def segment_room_endpoint(
    image_url: str = Form(...), bboxes: str = Form(...)
):
    import json

    bbox_list = json.loads(bboxes)
    result = await segment_room(image_url, bbox_list)
    return result
