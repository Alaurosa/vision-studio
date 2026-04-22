import asyncio
import os
import sys

# Add current dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.floorplan_parser import parse_floorplan

async def main():
    with open("/Users/williamliu/Documents/GitHub/vision-studio/floorplan.jpg", "rb") as f:
        bytes_data = f.read()
    res = await parse_floorplan(bytes_data, "image/jpeg")
    import json
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
