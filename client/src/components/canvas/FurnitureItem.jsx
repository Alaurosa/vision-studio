import { useEffect, useRef } from 'react';
import { Group, Rect, Text, Transformer } from 'react-konva';
import { CATEGORY_COLORS } from '@/utils/constants';
import { snapToGrid, getRotatedBoundingBox, normalizeRotation } from '@/utils/scale';
import { getAABB, overlaps, withinRoom } from '@/utils/collision';
import { GRID_SNAP_INCHES } from '@/utils/constants';

export default function FurnitureItem({ item, pxPerInch, offsetX, offsetY, selected, onSelect, onChange, room, allItems, onInvalidPlacement }) {
  const groupRef = useRef(null);
  const transformerRef = useRef(null);
  const color = item.color || CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
  const rot = normalizeRotation(item.rotation || 0);
  const w = item.width * pxPerInch;
  const d = item.depth * pxPerInch;
  const bbox = getRotatedBoundingBox(item.width || 0, item.depth || 0, rot);
  const bboxW = bbox.width * pxPerInch;
  const bboxH = bbox.depth * pxPerInch;
  const cx = offsetX + (item.x_inches || 0) * pxPerInch + bboxW / 2;
  const cy = offsetY + (item.y_inches || 0) * pxPerInch + bboxH / 2;

  useEffect(() => {
    if (!selected || !groupRef.current || !transformerRef.current) return;
    transformerRef.current.nodes([groupRef.current]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected, w, d]);

  const revertNode = () => {
    const node = groupRef.current;
    if (!node) return;
    node.position({ x: cx, y: cy });
    node.rotation(rot);
    node.scaleX(1);
    node.scaleY(1);
    node.getLayer()?.batchDraw();
  };

  const canCommitPatch = (patch) => {
    const nextItem = { ...item, ...patch };
    const box = getAABB(nextItem);
    if (!withinRoom(box, room)) {
      onInvalidPlacement?.(`${item.name || 'Item'} would extend outside the room.`);
      return false;
    }

    const conflicts = (allItems || []).some((other) => {
      if (other.id === item.id) return false;
      return overlaps(box, getAABB(other));
    });

    if (conflicts) {
      onInvalidPlacement?.(`${item.name || 'Item'} would overlap another furniture item.`);
      return false;
    }

    return true;
  };

  const handleDragStart = (e) => {
    e.cancelBubble = true;
  };

  const handleDragMove = (e) => {
    e.cancelBubble = true;
  };

  const handleDragEnd = (e) => {
    e.cancelBubble = true;
    const newCX = e.target.x();
    const newCY = e.target.y();
    const xInches = snapToGrid((newCX - bboxW / 2 - offsetX) / pxPerInch, GRID_SNAP_INCHES);
    const yInches = snapToGrid((newCY - bboxH / 2 - offsetY) / pxPerInch, GRID_SNAP_INCHES);
    const patch = { x_inches: Math.max(0, xInches), y_inches: Math.max(0, yInches) };
    if (!canCommitPatch(patch)) {
      revertNode();
      return;
    }
    e.target.position({
      x: offsetX + patch.x_inches * pxPerInch + bboxW / 2,
      y: offsetY + patch.y_inches * pxPerInch + bboxH / 2,
    });
    onChange(patch);
  };

  const handleTransformEnd = (e) => {
    e.cancelBubble = true;
    const node = groupRef.current;
    if (!node) return;
    const rotation = normalizeRotation(node.rotation());
    const rotatedBox = getRotatedBoundingBox(item.width || 0, item.depth || 0, rotation);
    const xInches = Math.max(0, (node.x() - offsetX) / pxPerInch - rotatedBox.width / 2);
    const yInches = Math.max(0, (node.y() - offsetY) / pxPerInch - rotatedBox.depth / 2);
    node.scaleX(1);
    node.scaleY(1);
    const patch = {
      rotation,
      x_inches: snapToGrid(xInches, GRID_SNAP_INCHES),
      y_inches: snapToGrid(yInches, GRID_SNAP_INCHES),
    };
    if (!canCommitPatch(patch)) {
      revertNode();
      return;
    }
    onChange(patch);
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={cx}
        y={cy}
        offsetX={w / 2}
        offsetY={d / 2}
        rotation={rot}
        draggable
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={(e) => { e.cancelBubble = true; onSelect(); }}
        onTap={(e) => { e.cancelBubble = true; onSelect(); }}
      >
        <Rect
          width={w}
          height={d}
          fill={color}
          stroke={selected ? '#100f0d' : 'rgba(16,15,13,0.35)'}
          strokeWidth={selected ? 2 : 1}
          cornerRadius={2}
          shadowColor="rgba(0,0,0,0.15)"
          shadowBlur={selected ? 12 : 4}
          shadowOffset={{ x: 0, y: 2 }}
        />
        <Rect width={w} height={3} fill="rgba(16,15,13,0.35)" />
        <Text
          x={6} y={6}
          width={Math.max(0, w - 12)}
          text={item.name || item.category}
          fontSize={11}
          fontFamily="Inter, sans-serif"
          fill="rgba(16,15,13,0.85)"
          ellipsis
          listening={false}
        />
        <Text
          x={6} y={d - 16}
          width={Math.max(0, w - 12)}
          text={`${item.width}" × ${item.depth}"`}
          fontSize={9}
          fill="rgba(16,15,13,0.55)"
          listening={false}
        />
      </Group>
      {selected && (
        <Transformer
          ref={transformerRef}
          enabledAnchors={[]}
          rotateEnabled
          rotateAnchorOffset={22}
          borderStroke="#100f0d"
          borderStrokeWidth={1}
          anchorStroke="#100f0d"
          anchorFill="#faf7f1"
          anchorSize={8}
          keepRatio
          boundBoxFunc={(oldBox) => oldBox}
        />
      )}
    </>
  );
}
