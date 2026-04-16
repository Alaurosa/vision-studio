import os
import asyncio
import json
import base64
import cv2
import numpy as np
from PIL import Image
import io
import httpx

REPLICATE_TOKEN = os.getenv("REPLICATE_API_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GROUNDING_DINO_MODEL = "adirik/grounding-dino:efd10a8ddc57ea28773327e881ce95e20cc1d734c589f7dd01d2036921ed78aa"
SAM3_MODEL = "meta/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83"

# Room labels for Grounding DINO detection
ROOM_LABELS = "room . bedroom . kitchen . bathroom . living room . hallway . dining room . office . closet . garage . laundry room"


def _image_to_data_uri(image_bytes: bytes) -> tuple:
    """Convert image bytes to PNG data URI and return (data_uri, width, height)."""
    img = Image.open(io.BytesIO(image_bytes))
    img_w, img_h = img.size
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}", img_w, img_h


def _mask_url_to_polygon(mask_url: str, img_w: int, img_h: int) -> list:
    """Download a SAM mask image URL and extract polygon contour via OpenCV."""
    try:
        resp = httpx.get(mask_url, timeout=30)
        resp.raise_for_status()
        nparr = np.frombuffer(resp.content, np.uint8)
        mask = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if mask is None:
            return []
        # Resize mask to match original image dimensions if needed
        if mask.shape[0] != img_h or mask.shape[1] != img_w:
            mask = cv2.resize(mask, (img_w, img_h), interpolation=cv2.INTER_NEAREST)
        # Threshold to binary
        _, binary = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
        # Find contours
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return []
        largest = max(contours, key=cv2.contourArea)
        # Douglas-Peucker simplification
        epsilon = 0.01 * cv2.arcLength(largest, True)
        approx = cv2.approxPolyDP(largest, epsilon, True)
        return [[int(p[0][0]), int(p[0][1])] for p in approx]
    except Exception as e:
        print(f"Mask polygon extraction failed: {e}")
        return []


def _mask_data_to_polygon(mask_data, img_w: int, img_h: int) -> list:
    """Extract polygon from various SAM mask output formats."""
    if isinstance(mask_data, str) and (mask_data.startswith("http") or mask_data.startswith("data:")):
        if mask_data.startswith("http"):
            return _mask_url_to_polygon(mask_data, img_w, img_h)
        # data URI mask
        try:
            b64_part = mask_data.split(",", 1)[1]
            mask_bytes = base64.b64decode(b64_part)
            nparr = np.frombuffer(mask_bytes, np.uint8)
            mask = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
            if mask is None:
                return []
            _, binary = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return []
            largest = max(contours, key=cv2.contourArea)
            epsilon = 0.01 * cv2.arcLength(largest, True)
            approx = cv2.approxPolyDP(largest, epsilon, True)
            return [[int(p[0][0]), int(p[0][1])] for p in approx]
        except Exception:
            return []
    # Dict with polygon or mask key
    if isinstance(mask_data, dict):
        if "polygon" in mask_data:
            return mask_data["polygon"]
        if "mask" in mask_data:
            return _mask_data_to_polygon(mask_data["mask"], img_w, img_h)
    return []



async def _openai_vision_analyze(image_bytes: bytes) -> dict:
    """
    Use OpenAI Codex 5.3 vision to analyze a floor plan image.
    Returns rooms as clean rectangular bounding boxes with labels.
    Much more accurate than OpenCV for understanding room semantics.
    """
    if not OPENAI_API_KEY:
        return None

    from openai import OpenAI

    # Get image dimensions
    img = Image.open(io.BytesIO(image_bytes))
    img_w, img_h = img.size

    # Encode image as base64
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    data_uri = f"data:image/png;base64,{b64}"

    client = OpenAI(api_key=OPENAI_API_KEY)

    prompt = f"""Analyze this floor plan image ({img_w}x{img_h} pixels). Identify each distinct room/space.

For EACH room, provide:
1. "label": descriptive name (e.g. "Living Room", "Kitchen", "Bedroom 1", "Bathroom", "Hallway")
2. "bbox": [x1, y1, x2, y2] in pixel coordinates — a tight RECTANGULAR bounding box around the room
   - x1,y1 = top-left corner of the room
   - x2,y2 = bottom-right corner of the room
   - Coordinates must be in pixel space (0 to {img_w} for x, 0 to {img_h} for y)
3. "confidence": 0.0-1.0 how confident you are this is a real room

IMPORTANT RULES:
- Each room should be a RECTANGLE (axis-aligned bounding box)
- Rooms should NOT overlap significantly
- Include ALL visible rooms, even small ones like closets and bathrooms
- The bounding box should tightly fit the room walls
- Do NOT include the outer walls/exterior as a room
- Look at the drawn walls, doors, and labels in the floor plan to identify rooms

Return ONLY a JSON object in this exact format, no other text:
{{"rooms": [{{"label": "Living Room", "bbox": [x1, y1, x2, y2], "confidence": 0.9}}, ...]}}"""

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="gpt-5.3-chat-latest",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_uri, "detail": "high"}},
                        ],
                    }
                ],
                max_completion_tokens=2048,
                temperature=0.1,
            ),
        )

        text = response.choices[0].message.content.strip()
        # Extract JSON from response (might be wrapped in ```json ... ```)
        if "```" in text:
            json_match = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1]
            text = json_match.strip()

        result = json.loads(text)
        raw_rooms = result.get("rooms", [])

        rooms = []
        for r in raw_rooms:
            bbox = r.get("bbox", [])
            if len(bbox) != 4:
                continue
            x1, y1, x2, y2 = [int(v) for v in bbox]
            # Clamp to image bounds
            x1 = max(0, min(x1, img_w))
            y1 = max(0, min(y1, img_h))
            x2 = max(0, min(x2, img_w))
            y2 = max(0, min(y2, img_h))
            if x2 <= x1 or y2 <= y1:
                continue

            w = x2 - x1
            h = y2 - y1
            area = w * h
            # Skip tiny regions (less than 1% of image)
            if area < img_w * img_h * 0.01:
                continue

            # Convert bbox to rectangular polygon (4 corners)
            polygon = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]

            rooms.append({
                "label": r.get("label", f"Room {len(rooms) + 1}"),
                "polygon": polygon,
                "bbox": [x1, y1, x2, y2],
                "area_px": float(area),
                "confidence": float(r.get("confidence", 0.8)),
            })

        if not rooms:
            print("OpenAI Vision returned no valid rooms")
            return None

        rooms.sort(key=lambda r: r["area_px"], reverse=True)

        # Overall boundary from all rooms
        all_x1 = min(r["bbox"][0] for r in rooms)
        all_y1 = min(r["bbox"][1] for r in rooms)
        all_x2 = max(r["bbox"][2] for r in rooms)
        all_y2 = max(r["bbox"][3] for r in rooms)

        walls = [
            [all_x1, all_y1], [all_x2, all_y1],
            [all_x2, all_y2], [all_x1, all_y2]
        ]

        print(f"OpenAI Vision detected {len(rooms)} rooms: {[r['label'] for r in rooms]}")

        return {
            "rooms": rooms,
            "walls": walls,
            "wall_segments": [],
            "image_width": img_w,
            "image_height": img_h,
            "boundary": {"x": all_x1, "y": all_y1, "w": all_x2 - all_x1, "h": all_y2 - all_y1},
            "method": "openai_vision",
            "fallback": False,
        }

    except Exception as e:
        print(f"OpenAI Vision analysis failed: {e}")
        return None


def _opencv_fallback(image_bytes: bytes) -> dict:
    """
    OpenCV-based floor plan parsing fallback.
    Two-pass approach:
    1. Detect wall lines via HoughLinesP and extend them to close door gaps
    2. Use cleaned wall drawing with RETR_CCOMP hierarchy to find rooms as holes
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"error": "Could not decode image", "rooms": [], "walls": [], "fallback": True}

    img_h, img_w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # --- Pass 1: Get wall pixels ---
    block_size = max(11, (min(img_w, img_h) // 40) | 1)
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, blockSize=block_size, C=6
    )
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    wall_pixels = cv2.bitwise_or(thresh, otsu)

    # Light morphological close to connect nearby wall fragments
    k = max(3, min(img_w, img_h) // 200)
    kernel = np.ones((k, k), np.uint8)
    wall_pixels = cv2.morphologyEx(wall_pixels, cv2.MORPH_CLOSE, kernel, iterations=2)

    # --- Pass 2: Detect line segments and draw them extended ---
    wall_drawing = np.zeros((img_h, img_w), dtype=np.uint8)
    wall_thickness = max(4, min(img_w, img_h) // 150)
    min_line_len = max(20, min(img_w, img_h) // 20)
    max_line_gap = max(10, min(img_w, img_h) // 30)

    lines = cv2.HoughLinesP(wall_pixels, 1, np.pi / 180,
                             threshold=50,
                             minLineLength=min_line_len,
                             maxLineGap=max_line_gap)

    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            # Extend each line by 20% on both ends to bridge small gaps
            dx, dy = x2 - x1, y2 - y1
            length = max(1, np.sqrt(dx * dx + dy * dy))
            ext = 0.15  # 15% extension
            nx1 = int(x1 - dx * ext)
            ny1 = int(y1 - dy * ext)
            nx2 = int(x2 + dx * ext)
            ny2 = int(y2 + dy * ext)
            # Clamp to image bounds
            nx1, ny1 = max(0, nx1), max(0, ny1)
            nx2, ny2 = min(img_w - 1, nx2), min(img_h - 1, ny2)
            cv2.line(wall_drawing, (nx1, ny1), (nx2, ny2), 255, wall_thickness)

    # Collect raw wall line segments for editor rendering
    wall_segments = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            wall_segments.append({"start": [int(x1), int(y1)], "end": [int(x2), int(y2)]})

    # Also keep original wall pixels (for curved/diagonal walls HoughLines misses)
    wall_drawing = cv2.bitwise_or(wall_drawing, wall_pixels)

    # Morphological close on the clean drawing
    close_k = max(5, min(img_w, img_h) // 100)
    close_kernel = np.ones((close_k, close_k), np.uint8)
    wall_drawing = cv2.morphologyEx(wall_drawing, cv2.MORPH_CLOSE, close_kernel, iterations=3)
    wall_drawing = cv2.dilate(wall_drawing, close_kernel, iterations=1)

    # --- Pass 3: Find rooms using distance transform + watershed ---
    # This approach correctly separates rooms connected by narrow doorways.
    # 1. Invert wall drawing to get interior space
    # 2. Flood-fill exterior from image edges
    # 3. Distance transform to find room "cores" far from walls
    # 4. Watershed to expand cores back to full room boundaries

    interior = cv2.bitwise_not(wall_drawing)

    # Flood-fill from image corners/edges to mark exterior space
    flood_mask = np.zeros((img_h + 2, img_w + 2), dtype=np.uint8)
    exterior = interior.copy()
    for seed in [(0, 0), (img_w - 1, 0), (0, img_h - 1), (img_w - 1, img_h - 1),
                 (img_w // 2, 0), (0, img_h // 2), (img_w - 1, img_h // 2), (img_w // 2, img_h - 1)]:
        if interior[seed[1], seed[0]] == 255:
            cv2.floodFill(exterior, flood_mask, seed, 128)
    interior[exterior == 128] = 0

    # Clean up small noise
    interior = cv2.morphologyEx(interior, cv2.MORPH_OPEN, close_kernel, iterations=1)

    # Distance transform: each interior pixel gets distance to nearest wall
    dist = cv2.distanceTransform(interior, cv2.DIST_L2, 5)

    # Estimate door width threshold — doorways are narrow passages (~3-5% of image)
    # Points deeper than this threshold are "room cores" (definitely inside a room)
    door_threshold = max(8, min(img_w, img_h) * 0.035)

    # Room cores: interior points far enough from walls (can't be in a doorway)
    _, sure_fg = cv2.threshold(dist, door_threshold, 255, cv2.THRESH_BINARY)
    sure_fg = sure_fg.astype(np.uint8)

    # Clean small fragments from room cores
    small_kernel = np.ones((5, 5), np.uint8)
    sure_fg = cv2.morphologyEx(sure_fg, cv2.MORPH_OPEN, small_kernel, iterations=1)

    # Find connected components of room cores
    num_core_labels, core_labels = cv2.connectedComponents(sure_fg, connectivity=4)

    rooms = []
    min_area = img_h * img_w * 0.015

    if num_core_labels > 2:
        # Multiple room cores detected — use watershed to expand each core
        # to fill the full interior space, respecting room boundaries
        # core_labels: 0=background, 1+=room cores
        # After +1: 1=background (walls/exterior), 2+=room cores
        # Doorway pixels (interior but not sure_fg) are set to 0 (unknown for watershed)
        # Walls/exterior stay as label 1 (preserved by watershed, excluded from rooms)
        markers = core_labels.copy().astype(np.int32) + 1
        unknown = cv2.subtract(interior, sure_fg)
        markers[unknown == 255] = 0  # doorways/transitions are unknown

        img3ch = cv2.cvtColor(interior, cv2.COLOR_GRAY2BGR)
        cv2.watershed(img3ch, markers)

        # Extract rooms from watershed result (labels 2+ are rooms)
        for label_id in range(2, num_core_labels + 1):
            room_mask = np.where(markers == label_id, np.uint8(255), np.uint8(0))
            area = cv2.countNonZero(room_mask)
            if area < min_area:
                continue

            # Get bounding box
            coords = cv2.findNonZero(room_mask)
            if coords is None:
                continue
            bx, by, bw, bh = cv2.boundingRect(coords)

            # Skip very thin strips
            aspect = max(bw, bh) / max(1, min(bw, bh))
            if aspect > 6:
                continue

            # Skip tiny regions near image edges
            edge_margin = max(img_w, img_h) * 0.08
            if (bx < edge_margin and bw < edge_margin * 2) or (by < edge_margin and bh < edge_margin * 2):
                continue
            if ((bx + bw) > img_w - edge_margin and bw < edge_margin * 2) or ((by + bh) > img_h - edge_margin and bh < edge_margin * 2):
                continue

            # Extract polygon contour — use rectangular bounding box for clean outlines
            points = [[int(bx), int(by)], [int(bx + bw), int(by)], [int(bx + bw), int(by + bh)], [int(bx), int(by + bh)]]

            rooms.append({
                "label": f"Room {len(rooms) + 1}",
                "polygon": points,
                "bbox": [int(bx), int(by), int(bx + bw), int(by + bh)],
                "area_px": float(area),
                "confidence": 0.75,
            })
    else:
        # Single room core or none — fall back to simple connected components
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(interior, connectivity=4)

        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area < min_area:
                continue
            x = stats[i, cv2.CC_STAT_LEFT]
            y = stats[i, cv2.CC_STAT_TOP]
            w = stats[i, cv2.CC_STAT_WIDTH]
            h = stats[i, cv2.CC_STAT_HEIGHT]

            aspect = max(w, h) / max(1, min(w, h))
            if aspect > 6:
                continue
            edge_margin = max(img_w, img_h) * 0.08
            if (x < edge_margin and w < edge_margin * 2) or (y < edge_margin and h < edge_margin * 2):
                continue
            if ((x + w) > img_w - edge_margin and w < edge_margin * 2) or ((y + h) > img_h - edge_margin and h < edge_margin * 2):
                continue

            # Use rectangular bounding box for clean outlines
            points = [[int(x), int(y)], [int(x + w), int(y)], [int(x + w), int(y + h)], [int(x), int(y + h)]]

            rooms.append({
                "label": f"Room {len(rooms) + 1}",
                "polygon": points,
                "bbox": [int(x), int(y), int(x + w), int(y + h)],
                "area_px": float(stats[i, cv2.CC_STAT_AREA]),
                "confidence": 0.70,
            })

    rooms.sort(key=lambda r: r["area_px"], reverse=True)

    # Boundary: outer contour of the wall drawing
    wall_contours, _ = cv2.findContours(wall_drawing, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boundary_points = []
    if wall_contours:
        largest = max(wall_contours, key=cv2.contourArea)
        epsilon = 0.01 * cv2.arcLength(largest, True)
        approx = cv2.approxPolyDP(largest, epsilon, True)
        boundary_points = [[int(p[0][0]), int(p[0][1])] for p in approx]

    if rooms:
        bx = min(r["bbox"][0] for r in rooms)
        by = min(r["bbox"][1] for r in rooms)
        bx2 = max(r["bbox"][2] for r in rooms)
        by2 = max(r["bbox"][3] for r in rooms)
        bw, bh = bx2 - bx, by2 - by
    else:
        bx, by, bw, bh = 0, 0, img_w, img_h

    return {
        "rooms": rooms,
        "walls": boundary_points,
        "wall_segments": wall_segments,
        "image_width": img_w,
        "image_height": img_h,
        "boundary": {"x": int(bx), "y": int(by), "w": int(bw), "h": int(bh)},
        "method": "opencv",
        "fallback": False,
        "line_count": len(lines) if lines is not None else 0,
    }


async def parse_floorplan(image_bytes: bytes, content_type: str) -> dict:
    """
    Parse a floor plan image to detect and segment individual rooms.

    Pipeline (priority order):
    1. OpenAI Codex 5.3 Vision — best accuracy, returns clean rectangular room outlines
    2. Grounding DINO + SAM 3 via Replicate — good but irregular polygons
    3. OpenCV fallback — works offline but least accurate
    """
    # Decode image for dimensions
    try:
        data_uri, img_w, img_h = _image_to_data_uri(image_bytes)
    except Exception as e:
        return {"error": f"Could not decode image: {e}", "rooms": [], "walls": [], "fallback": True}

    # --- Method 1: OpenAI Vision (preferred) ---
    if OPENAI_API_KEY:
        print("Trying OpenAI Vision for floor plan analysis...")
        result = await _openai_vision_analyze(image_bytes)
        if result and result.get("rooms"):
            return result
        print("OpenAI Vision failed or returned no rooms, trying next method...")

    # --- Method 2: DINO + SAM via Replicate ---
    if not REPLICATE_TOKEN:
        print("No REPLICATE_API_TOKEN — using OpenCV fallback for floor plan parsing")
        return _opencv_fallback(image_bytes)

    loop = asyncio.get_event_loop()

    try:
        import replicate

        # Step 1: Grounding DINO to detect room regions
        print(f"Running Grounding DINO on {img_w}x{img_h} floor plan...")
        dino_output = await loop.run_in_executor(
            None,
            lambda: replicate.run(
                GROUNDING_DINO_MODEL,
                input={
                    "image": data_uri,
                    "query": ROOM_LABELS,
                    "box_threshold": 0.15,
                    "text_threshold": 0.15,
                },
            ),
        )

        if not dino_output or not isinstance(dino_output, list) or len(dino_output) == 0:
            print("DINO found no rooms — falling back to OpenCV")
            return _opencv_fallback(image_bytes)

        print(f"DINO detected {len(dino_output)} regions")

        # Collect all detections with their bboxes
        detections = []
        for item in dino_output:
            box = item.get("box", [])
            label = item.get("label", "room")
            score = float(item.get("score", 0))
            if len(box) == 4 and score > 0.1:
                detections.append({"label": label, "bbox": box, "score": score})

        if not detections:
            print("No valid bboxes from DINO — falling back to OpenCV")
            return _opencv_fallback(image_bytes)

        # Step 2: SAM 3 segmentation on ALL detected regions
        print(f"Running SAM 3 on {len(detections)} detected regions...")
        all_bboxes = [d["bbox"] for d in detections]

        try:
            sam_output = await loop.run_in_executor(
                None,
                lambda: replicate.run(
                    SAM3_MODEL,
                    input={
                        "image": data_uri,
                        "input_boxes": json.dumps(all_bboxes),
                    },
                ),
            )
            print(f"SAM returned: {type(sam_output).__name__}, len={len(sam_output) if isinstance(sam_output, list) else 'N/A'}")
        except Exception as sam_err:
            print(f"SAM failed: {sam_err} — extracting polygons from bboxes")
            sam_output = None

        # Step 3: Extract polygon contours from SAM masks
        rooms = []
        for i, det in enumerate(detections):
            polygon = []

            # Try extracting polygon from SAM output
            if sam_output and isinstance(sam_output, list) and i < len(sam_output):
                mask_item = sam_output[i]
                polygon = _mask_data_to_polygon(mask_item, img_w, img_h)

            # Fallback: convert bbox to pixel-space polygon
            if not polygon or len(polygon) < 3:
                bx = det["bbox"]
                x1 = int(bx[0] * img_w) if bx[0] <= 1 else int(bx[0])
                y1 = int(bx[1] * img_h) if bx[1] <= 1 else int(bx[1])
                x2 = int(bx[2] * img_w) if bx[2] <= 1 else int(bx[2])
                y2 = int(bx[3] * img_h) if bx[3] <= 1 else int(bx[3])
                polygon = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]

            rooms.append({
                "label": det["label"],
                "polygon": polygon,
                "bbox": det["bbox"],
                "confidence": det["score"],
                "area_px": float(cv2.contourArea(np.array(polygon, dtype=np.int32))) if len(polygon) >= 3 else 0,
            })

        # Sort rooms by area descending
        rooms.sort(key=lambda r: r["area_px"], reverse=True)

        # Overall boundary: union of all room polygons
        all_points = []
        for r in rooms:
            all_points.extend(r["polygon"])
        if all_points:
            pts = np.array(all_points, dtype=np.int32)
            x, y, w, h = cv2.boundingRect(pts)
            # Use convex hull as overall wall boundary
            hull = cv2.convexHull(pts)
            walls = [[int(p[0][0]), int(p[0][1])] for p in hull]
        else:
            x, y, w, h = 0, 0, img_w, img_h
            walls = [[0, 0], [img_w, 0], [img_w, img_h], [0, img_h]]

        return {
            "rooms": rooms,
            "walls": walls,
            "image_width": img_w,
            "image_height": img_h,
            "boundary": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
            "method": "dino_sam",
            "fallback": False,
        }

    except Exception as e:
        print(f"DINO+SAM pipeline failed: {e} — falling back to OpenCV")
        result = _opencv_fallback(image_bytes)
        result["error"] = f"AI pipeline error: {e}. Used OpenCV fallback."
        return result
