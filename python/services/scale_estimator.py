async def estimate_scale_from_image(image_url: str) -> dict:
    return {
        "scale_px_per_inch": None,
        "method": "manual_required",
        "message": "Click two points on the floor plan and enter the real-world distance to calibrate scale.",
    }
