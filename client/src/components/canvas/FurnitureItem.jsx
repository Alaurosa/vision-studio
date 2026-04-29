import { useEffect, useRef, useState } from 'react';
import { Group, Rect, Text, Transformer, Line } from 'react-konva';
import { CATEGORY_COLORS } from '@/utils/constants';
import { snapToGrid, getRotatedBoundingBox, normalizeRotation } from '@/utils/scale';
import { getAABB, overlaps, withinRoom } from '@/utils/collision';
import { GRID_SNAP_INCHES } from '@/utils/constants';

export default function FurnitureItem({ item, pxPerInch, offsetX, offsetY, selected, onSelect, onChange, room, allItems, onInvalidPlacement, placementBounds = null, viewOriginX = 0, viewOriginY = 0 }) {
  const [dragState, setDragState] = useState({ isDragging: false, snapX: null, snapY: null });
  const groupRef = useRef(null);
  const transformerRef = useRef(null);
  const [opacity, setOpacity] = useState(item._animDelay != null ? 0 : 1);
  const color = item.color || CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
  const rot = normalizeRotation(item.rotation || 0);
  const w = item.width * pxPerInch;
  const d = item.depth * pxPerInch;
  const bbox = getRotatedBoundingBox(item.width || 0, item.depth || 0, rot);
  const bboxW = bbox.width * pxPerInch;
  const bboxH = bbox.depth * pxPerInch;
  const cx = offsetX + ((item.x_inches || 0) - viewOriginX) * pxPerInch + bboxW / 2;
  const cy = offsetY + ((item.y_inches || 0) - viewOriginY) * pxPerInch + bboxH / 2;

  useEffect(() => {
    if (!selected || !groupRef.current || !transformerRef.current) return;
    transformerRef.current.nodes([groupRef.current]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected, w, d]);

  const [mounted, setMounted] = useState(item._animDelay == null);

  // Staggered fade-in animation on mount
  useEffect(() => {
    if (mounted) return;
    const delay = item._animDelay || 0;
    const timer = setTimeout(() => {
      setOpacity(1);
      setMounted(true);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

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

    if (placementBounds) {
      const insideZone = box.left >= placementBounds.left
        && box.top >= placementBounds.top
        && box.right <= placementBounds.right
        && box.bottom <= placementBounds.bottom;
      if (!insideZone) {
        onInvalidPlacement?.(`${item.name || 'Item'} must stay inside the selected room.`);
        return false;
      }
    }

    return true;
  };

  const handleDragStart = (e) => {
    e.cancelBubble = true;
    setDragState({ isDragging: true, snapX: null, snapY: null });
  };

  const handleDragMove = (e) => {
    e.cancelBubble = true;
    const newCX = e.target.x();
    const newCY = e.target.y();

    // Calculate potential snap positions
    const potentialX = (newCX - bboxW / 2 - offsetX) / pxPerInch + viewOriginX;
    const potentialY = (newCY - bboxH / 2 - offsetY) / pxPerInch + viewOriginY;

    const snappedX = snapToGrid(potentialX, GRID_SNAP_INCHES);
    const snappedY = snapToGrid(potentialY, GRID_SNAP_INCHES);

    const snapThreshold = 0.5; // inches
    const shouldSnapX = Math.abs(potentialX - snappedX) < snapThreshold;
    const shouldSnapY = Math.abs(potentialY - snappedY) < snapThreshold;

    setDragState({
      isDragging: true,
      snapX: shouldSnapX ? snappedX : null,
      snapY: shouldSnapY ? snappedY : null,
    });
  };

  const handleDragEnd = (e) => {
    e.cancelBubble = true;
    const newCX = e.target.x();
    const newCY = e.target.y();

    let xInches = (newCX - bboxW / 2 - offsetX) / pxPerInch + viewOriginX;
    let yInches = (newCY - bboxH / 2 - offsetY) / pxPerInch + viewOriginY;

    // Apply snapping if close to grid
    const snappedX = snapToGrid(xInches, GRID_SNAP_INCHES);
    const snappedY = snapToGrid(yInches, GRID_SNAP_INCHES);

    const snapThreshold = 0.5; // inches
    if (Math.abs(xInches - snappedX) < snapThreshold) xInches = snappedX;
    if (Math.abs(yInches - snappedY) < snapThreshold) yInches = snappedY;

    const patch = { x_inches: Math.max(0, xInches), y_inches: Math.max(0, yInches) };
    if (!canCommitPatch(patch)) {
      revertNode();
      setDragState({ isDragging: false, snapX: null, snapY: null });
      return;
    }
    e.target.position({
      x: offsetX + (patch.x_inches - viewOriginX) * pxPerInch + bboxW / 2,
      y: offsetY + (patch.y_inches - viewOriginY) * pxPerInch + bboxH / 2,
    });
    onChange(patch);
    setDragState({ isDragging: false, snapX: null, snapY: null });
  };

  const handleTransformEnd = (e) => {
    e.cancelBubble = true;
    const node = groupRef.current;
    if (!node) return;
    const rotation = normalizeRotation(node.rotation());
    const rotatedBox = getRotatedBoundingBox(item.width || 0, item.depth || 0, rotation);
    const xInches = Math.max(0, (node.x() - offsetX) / pxPerInch - rotatedBox.width / 2 + viewOriginX);
    const yInches = Math.max(0, (node.y() - offsetY) / pxPerInch - rotatedBox.depth / 2 + viewOriginY);
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
        opacity={opacity}
        draggable
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => { e.cancelBubble = true; onSelect(); }}
        onTap={(e) => { e.cancelBubble = true; onSelect(); }}
      >
        <Rect
          width={w}
          height={d}
          fill={color}
          stroke={selected ? '#3b82f6' : hovered ? '#6b7280' : 'rgba(16,15,13,0.35)'}
          strokeWidth={selected ? 3 : hovered ? 2 : 1}
          cornerRadius={3}
          shadowColor="rgba(0,0,0,0.2)"
          shadowBlur={selected ? 16 : hovered ? 8 : 4}
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
          rotateAnchorOffset={24}
          borderStroke="#3b82f6"
          borderStrokeWidth={2}
          borderDash={[4, 4]}
          anchorStroke="#3b82f6"
          anchorFill="#ffffff"
          anchorSize={10}
          keepRatio
          boundBoxFunc={(oldBox) => oldBox}
        />
      )}

      {/* Snapping guides */}
      {dragState.isDragging && dragState.snapX !== null && (
        <Line
          points={[
            offsetX + (dragState.snapX - viewOriginX) * pxPerInch, 0,
            offsetX + (dragState.snapX - viewOriginX) * pxPerInch, 10000
          ]}
          stroke="#10b981"
          strokeWidth={2}
          dash={[5, 5]}
          opacity={0.8}
        />
      )}
      {dragState.isDragging && dragState.snapY !== null && (
        <Line
          points={[
            0, offsetY + (dragState.snapY - viewOriginY) * pxPerInch,
            10000, offsetY + (dragState.snapY - viewOriginY) * pxPerInch
          ]}
          stroke="#10b981"
          strokeWidth={2}
          dash={[5, 5]}
          opacity={0.8}
        />
      )}
    </>
  );
}
