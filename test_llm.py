import asyncio
from services.floorplan_parser import parse_floorplan

async def main():
    with open("/Users/williamliu/Documents/GitHub/vision-studio/floorplan.jpg", "rb") as f:
        bytes_data = f.read()
    res = await parse_floorplan(bytes_data, "image/jpeg")
    import json
    print(json.dumps(res, indent=2))

asyncio.run(main())
