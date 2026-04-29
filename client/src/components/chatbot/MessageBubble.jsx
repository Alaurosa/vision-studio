import { motion } from 'framer-motion';

/**
 * Renders a single chat message with rich formatting.
 * Supports markdown-like bold, lists, and code blocks.
 * Shows action cards for tool invocations.
 */

/* ---- tiny inline markdown parser ---- */
function parseInline(text) {
  if (!text) return null;
  // Split by **bold** and `code` markers
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);

    const matches = [boldMatch, codeMatch].filter(Boolean);
    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    // Pick whichever appears first
    matches.sort((a, b) => a.index - b.index);
    const first = matches[0];
    const isBold = first === boldMatch;

    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    if (isBold) {
      parts.push(<strong key={key++} className="font-semibold">{first[1]}</strong>);
    } else {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 bg-ink-900/8 rounded text-[12px] font-mono">
          {first[1]}
        </code>
      );
    }

    remaining = remaining.slice(first.index + first[0].length);
  }

  return parts;
}

function renderContent(content) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let listBuffer = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-1 ml-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">{parseInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Bullet list items
    if (/^[-•*]\s/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^[-•*]\s/, ''));
      continue;
    }

    // Numbered list items
    if (/^\d+[.)]\s/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^\d+[.)]\s/, ''));
      continue;
    }

    flushList();

    if (trimmed === '') {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed">{parseInline(trimmed)}</p>
      );
    }
  }

  flushList();
  return elements;
}

/* ---- action result icons ---- */
const ACTION_ICONS = {
  move_furniture: '↗',
  rotate_furniture: '↻',
  add_furniture: '+',
  remove_furniture: '×',
  suggest_furniture: '💡',
  validate_layout: '✓',
  arrange_room: '⬡',
  swap_furniture: '⇄',
  furnish_room: '🏠',
};

function ActionCard({ action }) {
  const icon = ACTION_ICONS[action.function] || '⚡';
  const success = action.result?.success !== false;

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs ${
      success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
    }`}>
      <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink-900 mb-0.5">
          {action.function.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </div>
        <div className={`text-[11px] leading-relaxed truncate ${success ? 'text-emerald-700' : 'text-red-700'}`}>
          {action.result?.message || (success ? 'Completed' : 'Failed')}
        </div>
      </div>
    </div>
  );
}

export default function MessageBubble({ message, isLast = false }) {
  const isUser = message.role === 'user';
  const actions = message.actions || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[88%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Avatar + label for assistant */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center">
              <span className="text-[10px] text-paper-50 font-bold">V</span>
            </div>
            <span className="text-[10px] uppercase tracking-editorial text-ink-500">Studio AI</span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-ink-900 text-paper-50 rounded-br-md'
              : 'bg-paper-100 text-ink-900 border border-ink-900/10 rounded-bl-md'
          }`}
        >
          <div className="space-y-1.5">
            {isUser ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            ) : (
              renderContent(message.content)
            )}
          </div>
        </div>

        {/* Action cards */}
        {actions.length > 0 && (
          <div className="space-y-1.5 mt-1.5">
            {actions.map((action, i) => (
              <ActionCard key={i} action={action} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
