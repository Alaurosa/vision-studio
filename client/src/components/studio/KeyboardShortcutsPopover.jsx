import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Max stacking z-index so popover stays above navbar (z-50), editor chrome, and canvas. */
const Z_BACKDROP = 2147483646;
const Z_PANEL = 2147483647;

/**
 * Renders keyboard shortcuts in a body portal so it is not clipped by editor overflow/stacking.
 */
export default function KeyboardShortcutsPopover({ open, onClose, anchorRef }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) {
      setPos(null);
      return;
    }
    const el = anchorRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      setPos({
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
        maxH: window.innerHeight - r.bottom - 16,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 pointer-events-auto bg-ink-900/20"
        style={{ zIndex: Z_BACKDROP }}
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed w-64 max-h-[min(70vh,420px)] overflow-y-auto bg-paper-50 border border-ink-900/15 shadow-2xl rounded-lg p-4 pointer-events-auto"
        style={{ top: pos.top, right: pos.right, maxHeight: pos.maxH, zIndex: Z_PANEL }}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow mb-3">Keyboard Shortcuts</div>
        <ul className="text-xs text-ink-700 space-y-2">
          <li className="flex justify-between"><span>Undo</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">⌘Z</kbd></li>
          <li className="flex justify-between"><span>Redo</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">⌘⇧Z</kbd></li>
          <li className="flex justify-between"><span>Rotate selected</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">R</kbd></li>
          <li className="flex justify-between"><span>Delete selected</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">Del</kbd></li>
          <li className="flex justify-between"><span>Deselect</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">Esc</kbd></li>
          <li className="flex justify-between"><span>Zoom</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">Scroll</kbd></li>
          <li className="flex justify-between"><span>Pan canvas</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">Drag bg</kbd></li>
        </ul>
      </div>
    </>,
    document.body,
  );
}
