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
}) {
  const w = widthIn * INCHES_TO_METERS;
  const d = depthIn * INCHES_TO_METERS;
  const h = heightIn * INCHES_TO_METERS;
  const ox = leftIn * INCHES_TO_METERS;
  const oz = topIn * INCHES_TO_METERS;

  return (
    <group position={[ox, 0, oz]}>
      <RoomInterior3D interior={interior} roomW={w} roomD={d} roomH={h} />
    </group>
  );
}
