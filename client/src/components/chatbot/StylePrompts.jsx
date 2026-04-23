import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Categorized style-driven prompt suggestions for the chatbot.
 * Shows contextual prompts based on whether the room is empty or furnished.
 */

const STYLE_CATEGORIES = [
  {
    id: 'goals',
    label: 'Room Goals',
    icon: '🎯',
    prompts: [
      'I want a cozy reading nook in the corner',
      'Design a productive home office setup',
      'Create a social living room for entertaining',
      'Make this room feel spacious and airy',
      'I need a multi-functional studio apartment layout',
    ],
  },
  {
    id: 'style',
    label: 'Style & Mood',
    icon: '🎨',
    prompts: [
      'Give this room a warm Scandinavian feel',
      'I prefer a minimalist, clean aesthetic',
      'Go for a mid-century modern look',
      'Industrial chic with warm accents',
      'Create a Japanese-inspired zen space',
    ],
  },
  {
    id: 'furniture',
    label: 'Furniture',
    icon: '🪑',
    prompts: [
      'Suggest a sofa under $500',
      'What desks do you have for small spaces?',
      'Recommend a complete bedroom furniture set',
      'I need storage solutions for a tiny room',
      'Find matching nightstands and a dresser',
    ],
  },
  {
    id: 'layout',
    label: 'Layout & Arrange',
    icon: '📐',
    prompts: [
      'Auto-arrange everything for optimal flow',
      'Validate my current layout for issues',
      'Move the sofa against the far wall',
      'Rotate the desk to face the window',
      'Create clear walking paths between furniture',
    ],
  },
  {
    id: 'quick',
    label: 'Quick Actions',
    icon: '⚡',
    prompts: [
      'Furnish this as a living room on a budget',
      'Swap the current sofa for something smaller',
      'Remove all furniture and start fresh',
      'Add a coffee table near the sofa',
      'Check if anything overlaps or is out of bounds',
    ],
  },
];

const STYLE_CHIPS = [
  { label: 'Modern', value: 'modern' },
  { label: 'Scandinavian', value: 'scandinavian' },
  { label: 'Industrial', value: 'industrial' },
  { label: 'Mid-Century', value: 'mid-century modern' },
  { label: 'Minimalist', value: 'minimalist' },
  { label: 'Bohemian', value: 'bohemian' },
  { label: 'Rustic', value: 'rustic' },
  { label: 'Japandi', value: 'japandi' },
];

export default function StylePrompts({ onSend, compact = false }) {
  const [activeCategory, setActiveCategory] = useState('goals');
  const [selectedStyle, setSelectedStyle] = useState(null);

  const category = STYLE_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {/* Style preference chips */}
      {!compact && (
        <div>
          <div className="eyebrow mb-3">Your Style</div>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => {
                  setSelectedStyle(chip.value);
                  onSend(`I prefer a ${chip.value} style. Keep this in mind for all suggestions.`);
                }}
                className={`text-[10px] uppercase tracking-editorial rounded-full px-3 py-1.5 border transition ${
                  selectedStyle === chip.value
                    ? 'bg-sienna-500 text-paper-50 border-sienna-500'
                    : 'border-ink-900/15 text-ink-700 hover:border-sienna-500 hover:text-sienna-600'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div>
        <div className="flex gap-1 overflow-x-auto pb-1 mb-3 scrollbar-hide">
          {STYLE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 text-[10px] uppercase tracking-editorial rounded-full px-3 py-1.5 border transition flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-ink-900 text-paper-50 border-ink-900'
                  : 'border-ink-900/15 text-ink-700 hover:border-ink-900'
              }`}
            >
              <span className="text-xs">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Prompts list */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-1.5"
          >
            {category?.prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSend(prompt)}
                className="w-full text-left text-sm px-4 py-3 rounded-xl border border-ink-900/8 hover:border-ink-900/25 hover:bg-ink-900/[0.03] transition-all group"
              >
                <span className="text-ink-700 group-hover:text-ink-900 transition-colors">
                  {prompt}
                </span>
                <span className="float-right text-ink-400 group-hover:text-ink-600 transition-colors text-xs mt-0.5">
                  →
                </span>
              </button>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export { STYLE_CATEGORIES, STYLE_CHIPS };
