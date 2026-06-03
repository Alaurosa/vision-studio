import LoginModal from '@/components/auth/LoginModal';

const DEFAULT_TITLE = 'Save your project before entering the studio';
const DEFAULT_MESSAGE =
  'Create an account or sign in so your room design stays connected to you.';

/**
 * Auth gate shown before project finalization (vision handoff, confirm, etc.).
 */
export default function ProjectSaveAuthModal({ onClose, onAuthed, title, message }) {
  return (
    <LoginModal
      title={title || DEFAULT_TITLE}
      message={message || DEFAULT_MESSAGE}
      onClose={onClose}
      onAuthed={onAuthed}
    />
  );
}
