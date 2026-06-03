import { Rect, Group } from 'react-konva';
import {
  getWallArtStyle,
  normalizeRoomInterior,
  resolveWallAccentColor,
  resolveWallDisplayColor,
} from '@/data/roomInterior';

const WALL_BAND_IN = 10;

/**
 * Paints wall bands and optional wall art inside the 2D room floor rect.
 */
export default function RoomInteriorSurfaces({
  interior,
  originX,
  originY,
  widthPx,
  heightPx,
  pxPerInch,
  strokeScale = 1,
}) {
  if (!(widthPx > 0 && heightPx > 0)) return null;

  const config = normalizeRoomInterior(interior);
  const wallFill = resolveWallDisplayColor(config);
  const accent = resolveWallAccentColor(config);
  const band = WALL_BAND_IN * pxPerInch;
  const art = config.wallArt;
  const artStyle = art ? getWallArtStyle(art.styleId) : null;

  let artX = originX;
  let artY = originY;
  let artW = widthPx * 0.22;
  let artH = heightPx * 0.14;
  if (art) {
    switch (art.wall) {
      case 'north':
        artX = originX + widthPx / 2 - artW / 2;
        artY = originY + band * 0.35;
        break;
      case 'south':
        artX = originX + widthPx / 2 - artW / 2;
        artY = originY + heightPx - band - artH;
        break;
      case 'west':
        artW = heightPx * 0.14;
        artH = widthPx * 0.18;
        artX = originX + band * 0.35;
        artY = originY + heightPx / 2 - artH / 2;
        break;
      case 'east':
        artW = heightPx * 0.14;
        artH = widthPx * 0.18;
        artX = originX + widthPx - band - artW;
        artY = originY + heightPx / 2 - artH / 2;
        break;
      default:
        break;
    }
  }

  return (
    <Group listening={false}>
      <Rect x={originX} y={originY} width={widthPx} height={band} fill={wallFill} />
      <Rect
        x={originX}
        y={originY + heightPx - band}
        width={widthPx}
        height={band}
        fill={wallFill}
      />
      <Rect x={originX} y={originY} width={band} height={heightPx} fill={wallFill} />
      <Rect
        x={originX + widthPx - band}
        y={originY}
        width={band}
        height={heightPx}
        fill={wallFill}
      />

      {accent && config.wallpaperId && (
        <>
          <Rect
            x={originX + band}
            y={originY + 2 / strokeScale}
            width={widthPx - band * 2}
            height={2 / strokeScale}
            fill={accent}
            opacity={0.55}
          />
          <Rect
            x={originX + band}
            y={originY + heightPx - band}
            width={widthPx - band * 2}
            height={2 / strokeScale}
            fill={accent}
            opacity={0.55}
          />
        </>
      )}

      {artStyle && (
        <Rect
          x={artX}
          y={artY}
          width={artW}
          height={artH}
          fill={artStyle.color}
          stroke="#171717"
          strokeWidth={1.5 / strokeScale}
          cornerRadius={2 / strokeScale}
        />
      )}
    </Group>
  );
}
