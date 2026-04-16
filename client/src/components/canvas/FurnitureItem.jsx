import { Rect, Text, Group, Transformer, Circle } from 'react-konva';
import { useRef, useEffect, useState } from 'react';
import { CATEGORY_COLORS, GRID_SNAP_INCHES } from '../../utils/constants';
import { inchesToPx, snapToGrid } from '../../utils/scale';
import { getAABB, overlaps, snapToEdge } from '../../utils/collision';

export default function FurnitureItem({ item, scale, offsetX = 0, offsetY = 0, isSelected, onSelect, onChange, allFurniture = [], room, onContextMenu }) {
  const groupRef = useRef();
  const trRef = useRef();
  const [hasCollision, setHasCollision] = useState(false);

  const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
  const w = (item.width || 30) * scale;
  const d = (item.depth || 30) * scale;
  // Position the group at the center of the furniture for correct rotation
  const x = (item.x_inches || 0) * scale + offsetX + w / 2;
  const y = (item.y_inches || 0) * scale + offsetY + d / 2;

  // Check collisions whenever item position/rotation changes
  useEffect(() => {
    if (allFurniture.length < 2) { setHasCollision(false); return; }
    const myBox = getAABB(item);
    const colliding = allFurniture.some(other => {
      if (other.id === item.id) return false;
      return overlaps(myBox, getAABB(other));
    });
    setHasCollision(colliding);
  }, [item.x_inches, item.y_inches, item.rotation, item.width, item.depth, allFurniture]);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const checkCollision = (candidateItem) => {
    const myBox = getAABB(candidateItem);
    return allFurniture.some(other => {
      if (other.id === item.id) return false;
      return overlaps(myBox, getAABB(other));
    });
  };

  const handleDragEnd = (e) => {
    const gridPx = GRID_SNAP_INCHES * scale;
    // Group position is at center; convert back to top-left inches
    const rawX = e.target.x() - offsetX - w / 2;
    const rawY = e.target.y() - offsetY - d / 2;
    let newX = snapToGrid(rawX, gridPx) / scale;
    let newY = snapToGrid(rawY, gridPx) / scale;

    // Check collision at new position — snap to edge if overlapping
    const candidate = { ...item, x_inches: newX, y_inches: newY };
    if (checkCollision(candidate)) {
      const result = snapToEdge(candidate, allFurniture, room);
      newX = result.x_inches;
      newY = result.y_inches;
    }

    e.target.x(newX * scale + offsetX + w / 2);
    e.target.y(newY * scale + offsetY + d / 2);
    onChange({ x_inches: newX, y_inches: newY });
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const rawRotation = node.rotation();
    const snappedRotation = Math.round(rawRotation / 90) * 90 % 360;
    const finalRotation = snappedRotation < 0 ? snappedRotation + 360 : snappedRotation;

    // Check collision at new rotation
    const candidate = { ...item, rotation: finalRotation };
    if (checkCollision(candidate)) {
      // Revert rotation
      node.rotation(item.rotation || 0);
      node.scaleX(1);
      node.scaleY(1);
      return;
    }

    node.rotation(finalRotation);
    node.scaleX(1);
    node.scaleY(1);
    onChange({ rotation: finalRotation });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={x}
        y={y}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          onSelect();
          onContextMenu?.({
            x: e.evt.clientX,
            y: e.evt.clientY,
            item,
          });
        }}
        rotation={item.rotation || 0}
        offsetX={w / 2}
        offsetY={d / 2}
      >
        <Rect
          width={w}
          height={d}
          fill={hasCollision ? '#fecaca' : color}
          stroke={hasCollision ? '#ef4444' : isSelected ? '#2563eb' : '#555'}
          strokeWidth={hasCollision ? 2.5 : isSelected ? 2 : 1}
          cornerRadius={3}
          opacity={0.85}
          shadowColor="rgba(0,0,0,0.1)"
          shadowBlur={isSelected ? 8 : 2}
          shadowOffset={{ x: 0, y: 2 }}
        />
        <Text
          text={item.name || item.category || '?'}
          x={4}
          y={4}
          width={w - 8}
          fontSize={Math.min(12, w / 5)}
          fill="#333"
          wrap="none"
          ellipsis
        />
        {item.width && item.depth && (
          <Text
            text={`${item.width}"×${item.depth}"`}
            x={4}
            y={d - 16}
            width={w - 8}
            fontSize={9}
            fill="#666"
            wrap="none"
          />
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          resizeEnabled={false}
          borderStroke="#2563eb"
          borderStrokeWidth={1.5}
          anchorStroke="#2563eb"
          anchorFill="#dbeafe"
          anchorSize={10}
          anchorCornerRadius={5}
          rotateAnchorOffset={20}
          rotationSnaps={[0, 90, 180, 270]}
          rotateAnchorCursor="grab"
          onTransformEnd={handleTransformEnd}
        />
      )}
    </>
  );
}
