import os
import asyncio
import json
import base64
import cv2
import numpy as np
from PIL import Image
import io
from typing import Optional


def _get_openai_api_key() -> Optional[str]:
    return os.getenv("OPENAI_API_KEY")


def _get_replicate_token() -> Optional[str]:
    return os.getenv("REPLICATE_API_TOKEN")


def _image_to_data_uri(image_bytes: bytes) -> tuple:
    """Convert image bytes to PNG data URI and return (data_uri, width, height)."""
    img = Image.open(io.BytesIO(image_bytes))
    img_w, img_h = img.size
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}", img_w, img_h


def _prepare_floorplan_bytes(image_bytes: bytes, content_type: str) -> bytes:
    if content_type != "application/pdf":
        return image_bytes

    from pdf2image import convert_from_bytes

    pages = convert_from_bytes(image_bytes, dpi=160, first_page=1, last_page=1)
    if not pages:
        raise ValueError("PDF contained no renderable pages")

    out = io.BytesIO()
    pages[0].convert("RGB").save(out, format="PNG")
    return out.getvalue()


def _build_walls_mask(image_bytes: bytes):
    """Build a binary mask of architectural walls from the floorplan image.
    
    Architectural walls in blueprints are drawn with hatched/filled gray (~148)
    and dark outlines (0-15). Thresholding at 155 catches both. A morphological
    close fills small gaps in the hatching pattern.
    """
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 155, 255, cv2.THRESH_BINARY_INV)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)
    return mask, img.shape[1], img.shape[0]  # mask, width, height


def _snap_to_nearest_wall_v(walls_mask, x_approx, y_start, y_end, search_range=80, min_coverage=0.10):
    """Find the nearest vertical wall segment to x_approx within [y_start, y_end]."""
    h_mask = walls_mask.shape[0]
    y_start = max(0, int(y_start))
    y_end = min(h_mask, int(y_end))
    span = max(1, y_end - y_start)
    x_min = max(0, x_approx - search_range)
    x_max = min(walls_mask.shape[1], x_approx + search_range)

    candidates = []
    for x in range(x_min, x_max):
        col = walls_mask[y_start:y_end, x]
        coverage = np.count_nonzero(col) / span
        if coverage >= min_coverage:
            candidates.append(x)

    if not candidates:
        return x_approx

    # Group consecutive columns into wall segments
    segments = []
    seg_start = candidates[0]
    seg_end = candidates[0]
    for x in candidates[1:]:
        if x <= seg_end + 5:
            seg_end = x
        else:
            segments.append((seg_start, seg_end))
            seg_start = x
            seg_end = x
    segments.append((seg_start, seg_end))

    # Pick the segment whose center is nearest to x_approx
    best_x = x_approx
    best_dist = float("inf")
    for s, e in segments:
        center = (s + e) // 2
        dist = abs(center - x_approx)
        if dist < best_dist:
            best_dist = dist
            best_x = center
    return best_x


def _snap_to_nearest_wall_h(walls_mask, y_approx, x_start, x_end, search_range=80, min_coverage=0.10):
    """Find the nearest horizontal wall segment to y_approx within [x_start, x_end]."""
    w_mask = walls_mask.shape[1]
    x_start = max(0, int(x_start))
    x_end = min(w_mask, int(x_end))
    span = max(1, x_end - x_start)
    y_min = max(0, y_approx - search_range)
    y_max = min(walls_mask.shape[0], y_approx + search_range)

    candidates = []
    for y in range(y_min, y_max):
        row = walls_mask[y, x_start:x_end]
        coverage = np.count_nonzero(row) / span
        if coverage >= min_coverage:
            candidates.append(y)

    if not candidates:
        return y_approx

    segments = []
    seg_start = candidates[0]
    seg_end = candidates[0]
    for y in candidates[1:]:
        if y <= seg_end + 5:
            seg_end = y
        else:
            segments.append((seg_start, seg_end))
            seg_start = y
            seg_end = y
    segments.append((seg_start, seg_end))

    best_y = y_approx
    best_dist = float("inf")
    for s, e in segments:
        center = (s + e) // 2
        dist = abs(center - y_approx)
        if dist < best_dist:
            best_dist = dist
            best_y = center
    return best_y


async def _openai_vision_analyze(image_bytes: bytes) -> dict:
    """
    Grid-overlay + OpenAI Vision + wall-snap pipeline for precise room detection.

    1. Draws a visible 20×20 grid on the floorplan image.
    2. Asks the vision model to identify rooms using grid coordinates.
    3. Converts grid coords → pixel coords.
    4. Snaps every bounding-box edge to the nearest real architectural wall
       detected via OpenCV thresholding.
    """
    openai_api_key = _get_openai_api_key()
    if not openai_api_key:
        return None

    from openai import AsyncOpenAI

    # Decode image
    pil_img = Image.open(io.BytesIO(image_bytes))
    img_w, img_h = pil_img.size

    # Build wall mask for snapping
    walls_mask, _, _ = _build_walls_mask(image_bytes)

    # Draw 20×20 grid overlay on image
    GRID = 20
    arr = np.frombuffer(image_bytes, np.uint8)
    grid_img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    for i in range(GRID + 1):
        x = int(img_w * i / GRID)
        y = int(img_h * i / GRID)
        color = (0, 0, 255) if i % 5 == 0 else (180, 180, 255)
        thickness = 2 if i % 5 == 0 else 1
        cv2.line(grid_img, (x, 0), (x, img_h), color, thickness)
        cv2.line(grid_img, (0, y), (img_w, y), color, thickness)
        if i > 0:
            cv2.putText(grid_img, str(i), (int(img_w * i / GRID) - 15, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            cv2.putText(grid_img, str(i), (5, int(img_h * i / GRID) - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

    _, buffer = cv2.imencode(".jpg", grid_img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    grid_b64 = base64.b64encode(buffer).decode("utf-8")

    prompt = """You are analyzing an architectural floor plan with a red/pink 20x20 grid overlay.
Grid numbers go from 0 to 20 on both X (left-right) and Y (top-bottom) axes.

RULES:
- Provide bounding boxes as grid coordinates [x1, y1, x2, y2] using decimals for precision.
- The box must follow the INNER edges of the thick architectural walls.
- ONLY include real habitable rooms: bedrooms, bathrooms, kitchen, dining room, living room, den, office/study, laundry room, pantry, closets, walk-in closets, en-suite bathrooms, powder rooms, utility rooms, bonus rooms, family rooms, sunrooms, nurseries, game rooms, media rooms.
- Do NOT include: hallways, corridors, stairs/stairways, entry/foyer areas, porches, decks, patios, garages, exterior spaces, landings, vestibules, or any transitional/circulation spaces.
- If a room has a label on the plan, use that exact label.
- If you see dimension text inside or near a room (like 13'-4" X 9'-0"), read it and include it.

DIMENSION READING:
- 13'-4" = (13 × 12) + 4 = 160 inches
- 9'-0" = (9 × 12) + 0 = 108 inches
- 28'-0" = (28 × 12) + 0 = 336 inches
- For total building dimensions: look for dimension lines with arrows outside the building.

Return ONLY a JSON object:
{"rooms": [{"label": "Room Name", "bbox": [x1, y1, x2, y2], "confidence": 0.9, "width_inches": N_or_null, "depth_inches": N_or_null}], "total_width_inches": N_or_null, "total_depth_inches": N_or_null}"""

    try:
        client = AsyncOpenAI(api_key=openai_api_key)

        model = "gpt-5.4"
        response = await client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{grid_b64}", "detail": "high"}},
                ]}
            ],
            max_completion_tokens=2048,
            temperature=0,
        )

        text = response.choices[0].message.content
        if not text:
            print("OpenAI Vision returned empty response")
            return None
        text = text.strip()
        if "```" in text:
            json_part = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1]
            text = json_part.strip()

        result = json.loads(text)
        raw_rooms = result.get("rooms", [])

        print(f"GPT {model} detected {len(raw_rooms)} rooms via 20x20 grid")

        rooms = []
        for r in raw_rooms:
            bbox = r.get("bbox", [])
            if len(bbox) != 4:
                continue

            gx1, gy1, gx2, gy2 = [float(v) for v in bbox]

            # Convert grid coordinates to pixel coordinates
            px1 = int(gx1 * img_w / GRID)
            py1 = int(gy1 * img_h / GRID)
            px2 = int(gx2 * img_w / GRID)
            py2 = int(gy2 * img_h / GRID)

            # Snap each edge to the nearest architectural wall
            sx1 = _snap_to_nearest_wall_v(walls_mask, px1, py1, py2)
            sx2 = _snap_to_nearest_wall_v(walls_mask, px2, py1, py2)
            sy1 = _snap_to_nearest_wall_h(walls_mask, py1, px1, px2)
            sy2 = _snap_to_nearest_wall_h(walls_mask, py2, px1, px2)

            # Ensure valid box
            x1, x2 = min(sx1, sx2), max(sx1, sx2)
            y1, y2 = min(sy1, sy2), max(sy1, sy2)

            # Clamp to image bounds
            x1 = max(0, min(x1, img_w))
            y1 = max(0, min(y1, img_h))
            x2 = max(0, min(x2, img_w))
            y2 = max(0, min(y2, img_h))

            w = x2 - x1
            h = y2 - y1
            area = w * h
            if area < img_w * img_h * 0.005:
                continue

            polygon = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
            label = r.get("label", f"Room {len(rooms) + 1}")
            print(f"  {label}: grid=[{gx1},{gy1},{gx2},{gy2}] -> px=[{x1},{y1},{x2},{y2}]")

            rooms.append({
                "label": label,
                "polygon": polygon,
                "bbox": [x1, y1, x2, y2],
                "width": float(w),
                "depth": float(h),
                "area_px": float(area),
                "confidence": float(r.get("confidence", 0.9)),
                "width_inches": r.get("width_inches"),
                "depth_inches": r.get("depth_inches"),
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

        total_width_inches = result.get("total_width_inches")
        total_depth_inches = result.get("total_depth_inches")

        return {
            "rooms": rooms,
            "walls": walls,
            "wall_segments": [],
            "image_width": img_w,
            "image_height": img_h,
            "boundary": {"x": all_x1, "y": all_y1, "w": all_x2 - all_x1, "h": all_y2 - all_y1},
            "method": "openai_vision_grid_snap",
            "fallback": False,
            "total_width_inches": total_width_inches,
            "total_depth_inches": total_depth_inches,
        }

    except Exception as e:
        print(f"OpenAI Vision analysis failed: {e}")
        import traceback
        traceback.print_exc()
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
    1. OpenAI Vision (gpt-5.4 → gpt-4o fallback) — best accuracy, grid + wall-snap
    2. Grounding DINO + SAM 3 via Replicate — good but irregular polygons
    3. OpenCV fallback — works offline but least accurate
    """
    try:
        image_bytes = _prepare_floorplan_bytes(image_bytes, content_type)
    except Exception as e:
        return {"error": f"PDF conversion failed: {e}", "rooms": [], "walls": [], "fallback": True}

    # Decode image for dimensions
    try:
        data_uri, img_w, img_h = _image_to_data_uri(image_bytes)
    except Exception as e:
        return {"error": f"Could not decode image: {e}", "rooms": [], "walls": [], "fallback": True}

    # --- Method 1: OpenAI Vision Grid + Wall-Snap (preferred) ---
    if _get_openai_api_key():
        print("Trying OpenAI Vision grid + wall-snap for floor plan analysis...")
        llm_result = await _openai_vision_analyze(image_bytes)
        
        if llm_result and llm_result.get("rooms"):
            # Wall-snapping is already done inside _openai_vision_analyze
            return llm_result
            
        print("OpenAI Vision failed or returned no rooms, falling back to OpenCV...")

    # --- Method 2: OpenCV fallback — works offline ---
    return _opencv_fallback(image_bytes)
