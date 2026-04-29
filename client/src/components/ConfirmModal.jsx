import { motion, AnimatePresence } from 'framer-motion';

/**
 * Styled confirmation modal to replace `window.confirm`.
 *
 * Usage:
 * <ConfirmModal
 *   open={showConfirm}
 *   title="Delete room?"
 *   message="This cannot be undone."
 *   confirmLabel="Delete"
 *   danger
 *   onConfirm={() => { ... }}
 *   onCancel={() => setShowConfirm(false)}
 * />
 */
export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-ink-900/50 backdrop-blur-sm grid place-items-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="bg-paper-50 border border-ink-900/10 w-full max-w-sm p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="display-md mb-3">{title}</h3>
            {message && (
              <p className="text-ink-600 text-sm leading-relaxed mb-8">{message}</p>
            )}
            <div className="flex justify-end gap-3">
              <button className="btn-ghost" onClick={onCancel}>
                {cancelLabel}
              </button>
              <button
                className={danger
                  ? 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white text-[12px] tracking-editorial uppercase transition hover:bg-red-700'
                  : 'btn-ink'}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
