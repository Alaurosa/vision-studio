import os
import asyncio
import json
import io
import base64
from typing import Optional, List

REPLICATE_TOKEN = os.getenv("REPLICATE_API_TOKEN")
GROUNDING_DINO_MODEL = "adirik/grounding-dino:efd10a8ddc57ea28773327e881ce95e20cc1d734c589f7dd01d2036921ed78aa"
SAM3_MODEL = "meta/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83"


async def detect_objects(image_url: Optional[str], labels: List[str], file=None) -> dict:
    if not REPLICATE_TOKEN:
        return {
            "detections": [],
            "error": "REPLICATE_API_TOKEN not set — using manual mode",
        }

    # Build image input: use file if provided, otherwise image_url
    image_input = image_url
    if file:
        contents = await file.read()
        data_uri = "data:" + (file.content_type or "image/jpeg") + ";base64," + base64.b64encode(contents).decode()
        image_input = data_uri

    if not image_input:
        return {"detections": [], "error": "No image provided"}

    import replicate

    loop = asyncio.get_event_loop()
    try:
        output = await loop.run_in_executor(
            None,
            lambda: replicate.run(
                GROUNDING_DINO_MODEL,
                input={
                    "image": image_input,
                    "query": " . ".join(labels),
                    "box_threshold": 0.30,
                    "text_threshold": 0.25,
                },
            ),
        )
        detections = []
        if isinstance(output, list):
            for item in output:
                detections.append(
                    {
                        "label": item.get("label", "unknown"),
                        "score": round(float(item.get("score", 0)), 3),
                        "bbox": item.get("box", []),
                    }
                )
        return {"detections": detections, "error": None}
    except Exception as e:
        return {"detections": [], "error": str(e)}


async def segment_room(image_url: str, bboxes: list) -> dict:
    if not REPLICATE_TOKEN:
        return {"masks": [], "error": "REPLICATE_API_TOKEN not set"}

    import replicate

    loop = asyncio.get_event_loop()
    try:
        output = await loop.run_in_executor(
            None,
            lambda: replicate.run(
                SAM3_MODEL,
                input={
                    "image": image_url,
                    "input_boxes": json.dumps(bboxes),
                },
            ),
        )
        return {"masks": output if isinstance(output, list) else [], "error": None}
    except Exception as e:
        return {"masks": [], "error": str(e)}
