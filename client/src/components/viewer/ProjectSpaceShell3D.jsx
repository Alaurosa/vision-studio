import RoomShell3D from '@/components/viewer/RoomShell3D';
import RoomInterior3D from '@/components/viewer/RoomInterior3D';
import { INCHES_TO_METERS } from '@/utils/furniture3d';

/**
 * One floorplan space positioned in world meters (origin = property corner).
 */
export default function ProjectSpaceShell3D({
  leftIn,
  topIn,
  widthIn,
  depthIn,
  heightIn,
  interior = null,
  selected = false,
  showWalls = true,
}) {
  const w = widthIn * INCHES_TO_METERS;
  const d = depthIn * INCHES_TO_METERS;
  const h = heightIn * INCHES_TO_METERS;
  const ox = leftIn * INCHES_TO_METERS;
  const oz = topIn * INCHES_TO_METERS;
  const floorColor = selected ? '#e8dcc8' : undefined;

  return (
    <group position={[ox, 0, oz]}>
      <RoomShell3D
        widthM={w}
        depthM={d}
        heightM={h}
        showWalls={showWalls}
        floorColor={floorColor}
      />
      <RoomInterior3D interior={interior} roomW={w} roomD={d} />
    </group>
  );
}
