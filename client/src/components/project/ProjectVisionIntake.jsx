import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import MessageBubble from '@/components/chatbot/MessageBubble';
import { getProjectById, upsertProject } from '@/utils/projectCompat';
import { isProjectVisionComplete } from '@/utils/visionGate';

const EXAMPLE_PROMPTS = [
  'Create a warm family home with calm natural materials',
  'Design a modern coastal house with indoor-outdoor flow',
  'Make the interiors cozy, minimal, and good for hosting',
  'Plan a backyard, entryway, and living room around a relaxed Japandi style',
  'I have a small apartment and want storage-focused spaces',
  'Use my floorplan and help define the whole-house concept',
];

const STYLE_CHIPS = [
  'Modern',
  'Warm minimal',
  'Japandi',
  'Coastal',
  'Industrial',
  'Rustic',
  'Family-friendly',
  'Hosting-focused',
  'Budget-conscious',
  'Natural materials',
];

const GUIDED_QUESTIONS = [
  'What feeling should guests have when they enter?',
  'Which spaces matter most day to day?',
  'Should the exterior match the interior direction?',
  'Who uses this property most often, and how?',
  'Are there budget, furniture, or layout constraints to honor?',
];

function buildDeterministicVisionSuggestions(globalVision) {
  const styles = Array.isArray(globalVision?.styleKeywords) ? globalVision.styleKeywords : [];
  const vibe = globalVision?.moodVibe ? `Focus on a ${globalVision.moodVibe} mood` : 'Define one clear mood';
  const styleLine =
    styles.length > 0
      ? `Use this style direction consistently: ${styles.slice(0, 3).join(', ')}.`
      : 'Pick 2-3 style keywords (for example: warm minimal, coastal, Japandi).';
  const budget =
    globalVision?.budgetRange
      ? `Keep selections aligned to budget: ${globalVision.budgetRange}.`
      : 'Set a budget range to guide furniture and material tradeoffs.';
  return [vibe, styleLine, budget];
}

function getVisionReadiness(globalVision, scope = 'interior_exterior') {
  const text = (globalVision?.propertyVision || '').trim();
  const hasVisionText = text.length >= 60;
  const hasStyleMood =
    (Array.isArray(globalVision?.styleKeywords) && globalVision.styleKeywords.length > 0) ||
    Boolean((globalVision?.moodVibe || '').trim());
  const hasPurposeSignal = /(family|guest|kids|host|rental|work|live|lifestyle|daily)/i.test(text);
  const hasInteriorGoal =
    Boolean((globalVision?.interiorGoals || '').trim()) ||
    /(living|kitchen|bedroom|bathroom|office|interior|room)/i.test(text);
  const hasExteriorGoal =
    Boolean((globalVision?.exteriorGoals || '').trim()) ||
    /(yard|patio|balcony|garden|entry|curb|facade|exterior|outdoor)/i.test(text);

  const wantsInterior = scope !== 'exterior_only';
  const wantsExterior = scope === 'exterior_only' || scope === 'interior_exterior';

  const missing = [];
  if (!hasVisionText) missing.push('Add more detail about the overall property concept.');
  if (!hasStyleMood) missing.push('Add style or mood direction (chips or text).');
  if (!hasPurposeSignal) missing.push('Describe who uses the property and its purpose.');
  if (wantsInterior && !hasInteriorGoal) missing.push('Mention at least one interior goal.');
  if (wantsExterior && !hasExteriorGoal) missing.push('Mention at least one exterior goal.');

  return { ready: missing.length === 0, missing };
}

/** Draft room binding so chat API accepts vision-only projects with no space yet. */
export function getVisionChatRoomBinding(project) {
  const rid =
    project?.spaces?.find((s) => s.roomId || s.room_id)?.roomId ??
    project?.spaces?.find((s) => s.room_id)?.room_id ??
    null;
  if (rid) return { room_id: rid, room_context: null };
  const id = `draft-vision-${project.id}`;
  return {
    room_id: id,
    room_context: {
      id,
      name: `${project.name || 'Project'} — planning`,
      width: 240,
      depth: 180,
      height: 96,
      unit: 'inches',
      placements: [],
    },
  };
}

function normalizeThread(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m.content === 'string')
    .map((m, i) => ({
      id: m.id || `m-${i}-${m.role}`,
      role: m.role,
      content: m.content,
    }));
}

export default function ProjectVisionIntake({ project, onPersist }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setupNewFlow = searchParams.get('setup') === 'new';
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const themeMergedRef = useRef(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const gv = project?.globalVision || {};

  const [selectedChips, setSelectedChips] = useState(() => {
    const fromKeywords = new Set((gv.styleKeywords || []).map((k) => String(k).toLowerCase()));
    const picked = new Set();
    STYLE_CHIPS.forEach((c) => {
      if (fromKeywords.has(c.toLowerCase())) picked.add(c);
    });
    return picked;
  });

  const [messages, setMessages] = useState(() => {
    const saved = normalizeThread(gv.visionIntakeThread);
    if (saved.length > 0) return saved;
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "I'm your Project Vision Assistant. Before you edit individual rooms, tell me the overall direction: mood, style, budget, who lives here, interior and exterior goals, and any inspiration. When you are ready, use Review project and spaces at the bottom — that summary page is required before opening the editor.",
      },
    ];
  });

  useEffect(() => {
    if (!project || themeMergedRef.current) return;
    const themePrompt = project.theme?.prompt?.trim();
    const chips = project.theme?.styleChips || [];
    if (!themePrompt && chips.length === 0) return;
    themeMergedRef.current = true;
    const nextGv = {
      ...gv,
      propertyVision: [gv.propertyVision?.trim(), themePrompt].filter(Boolean).join('\n\n').trim(),
      styleKeywords: [...new Set([...(gv.styleKeywords || []), ...chips])],
    };
    const next = {
      ...project,
      globalVision: nextGv,
      updatedAt: new Date().toISOString(),
    };
    upsertProject(next);
    onPersist?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }),
      );
    }
  }, [messages, sending]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const persistFull = (nextMessages, nextGv) => {
    const p = getProjectById(project.id) || project;
    if (!p?.id) return;
    const thread = nextMessages.filter((m) => m.id !== 'welcome').map(({ id, role, content }) => ({ id, role, content }));
    const next = {
      ...p,
      globalVision: { ...nextGv, visionIntakeThread: thread },
      updatedAt: new Date().toISOString(),
    };
    upsertProject(next);
    onPersist?.(next);
  };

  const toggleChip = (chip) => {
    setSelectedChips((prev) => {
      const n = new Set(prev);
      if (n.has(chip)) n.delete(chip);
      else n.add(chip);
      const p0 = getProjectById(project.id) || project;
      const g0 = p0.globalVision || {};
      const mergedKeywords = [...new Set([...(g0.styleKeywords || []), ...Array.from(n)])];
      persistFull(messages, { ...g0, styleKeywords: mergedKeywords });
      return n;
    });
  };

  const sendUserMessage = async (text) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed || !project) return;

    const p0 = getProjectById(project.id) || project;
    const g0 = p0.globalVision || {};

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    const mergedKeywords = [...new Set([...(g0.styleKeywords || []), ...Array.from(selectedChips)])];
    const mergedVision = [g0.propertyVision?.trim(), trimmed].filter(Boolean).join('\n\n');
    const nextGv = { ...g0, propertyVision: mergedVision, styleKeywords: mergedKeywords };
    persistFull(nextMessages, nextGv);

    const binding = getVisionChatRoomBinding(p0);
    setSending(true);
    try {
      const { data } = await api.post('/api/chat/message', {
        room_id: binding.room_id,
        ...(binding.room_context ? { room_context: binding.room_context } : {}),
        message: trimmed,
        project_id: p0.id,
        space_id: null,
        context_type: 'whole_project',
        global_vision: nextGv,
        space_vision: null,
      });
      const assistantText = data.message || '(no response)';
      const assistantMsg = { id: `a-${Date.now()}`, role: 'assistant', content: assistantText };
      const withAssistant = [...nextMessages, assistantMsg];
      setMessages(withAssistant);
      persistFull(withAssistant, {
        ...nextGv,
        visionIntakeAssistantSummary: assistantText.slice(0, 2000),
      });
    } catch {
      toast('Vision saved. Using quick planning suggestions while AI is unavailable.', { duration: 4500 });
      const bullets = buildDeterministicVisionSuggestions(nextGv);
      const fallbackMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `Your direction is saved. Here are quick suggestions to keep moving:\n\n- ${bullets.join('\n- ')}\n\nContinue adding detail, or go to Review project and spaces when you are ready.`,
      };
      const withFb = [...nextMessages, fallbackMsg];
      setMessages(withFb);
      persistFull(withFb, nextGv);
    } finally {
      setSending(false);
    }
  };

  const effectiveGv = useMemo(() => {
    const userTexts = messages.filter((m) => m.role === 'user').map((m) => m.content);
    const pv = [gv.propertyVision, ...userTexts].filter(Boolean).join('\n\n').trim();
    const kw = [...new Set([...(gv.styleKeywords || []), ...Array.from(selectedChips)])];
    return { ...gv, propertyVision: pv, styleKeywords: kw };
  }, [gv, messages, selectedChips]);

  const visionReady = isProjectVisionComplete(effectiveGv);
  const readiness = useMemo(
    () => getVisionReadiness(effectiveGv, project?.scope || 'interior_exterior'),
    [effectiveGv, project?.scope],
  );

  const handleReviewContinue = () => {
    if (!project) return;
    if (!visionReady || !readiness.ready) {
      toast.error('Add a bit more project context before review so the plan is actionable.');
      return;
    }
    const next = {
      ...project,
      globalVision: {
        ...effectiveGv,
        visionIntakeThread: messages.filter((m) => m.id !== 'welcome').map(({ id, role, content }) => ({
          id,
          role,
          content,
        })),
      },
      visionIntakeCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertProject(next);
    onPersist?.(next);
    if (setupNewFlow) {
      navigate(`/studio/project/${project.id}/confirm`);
    } else {
      navigate(`/studio/project/${project.id}`);
    }
  };

  if (!project) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <span className="eyebrow text-ink-500">Loading project…</span>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Project Vision Assistant — {project.name || 'Project'}</title>
      </Helmet>
      <div className="min-h-[100dvh] flex flex-col bg-[#f6f3ee] text-[#171717]">
        <div className="border-b border-[rgba(0,0,0,0.08)] bg-[#eef4f7]/80 backdrop-blur-sm shrink-0">
          <div className="mx-auto max-w-3xl px-6 py-10 md:px-8">
            <div className="flex flex-wrap gap-4 mb-6">
              <Link
                to={`/studio/project/${project.id}`}
                className="text-[10px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] inline-block"
              >
                ← Return to project
              </Link>
              <Link
                to="/studio"
                className="text-[10px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] inline-block"
              >
                All projects
              </Link>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-vs-accent mb-3">Whole-property planning</p>
            <h1 className="font-display text-[clamp(1.75rem,4vw,2.35rem)] font-medium leading-tight tracking-[-0.02em]">
              Project Vision Assistant
            </h1>
            <p className="mt-4 text-sm text-[#5b5b5b] max-w-2xl leading-relaxed">
              Define the overall direction for the home before editing individual spaces.
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-3xl px-6 md:px-8 pb-6">
          <div className="h-14 border-b border-[rgba(0,0,0,0.08)] flex items-center justify-between px-1 shrink-0 bg-[#f8f8f6]/90">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#004aad] to-[#003580] grid place-items-center shadow-sm">
                <span className="text-sm text-paper-50 font-display font-semibold">V</span>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-vs-accent">Vision Studio</div>
                <div className="font-display text-base text-[#171717]">Project Vision Assistant</div>
                <div className="text-[10px] uppercase tracking-editorial text-[#5b5b5b]">Before individual room edits</div>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <MessageBubble key={m.id} message={m} isLast={i === messages.length - 1} />
              ))}
            </AnimatePresence>
            {sending && (
              <div className="flex items-center gap-2 text-xs text-[#5b5b5b]">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Assistant is thinking…
              </div>
            )}
          </div>

          <div className="border-t border-[rgba(0,0,0,0.06)] pt-5 shrink-0 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Style direction</p>
              <div className="flex flex-wrap gap-2">
                {STYLE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleChip(chip)}
                    className={`text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border transition ${
                      selectedChips.has(chip)
                        ? 'border-[#004aad] bg-[#eef4f7] text-[#004aad]'
                        : 'border-[rgba(0,0,0,0.1)] text-[#5b5b5b] hover:border-[#004aad]/40'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Example prompts</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => sendUserMessage(p)}
                    disabled={sending}
                    className="text-left text-xs text-[#2d2d2d] rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] px-3 py-2 max-w-full hover:border-[#004aad]/35 transition disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-[#fffdf9] border border-[rgba(0,0,0,0.1)] rounded-2xl px-4 py-3 text-sm text-[#171717] placeholder:text-[#9a9a9a] resize-none focus:outline-none focus:border-[#004aad]/45 focus:ring-2 focus:ring-[#004aad]/10 min-h-[52px] max-h-[140px]"
                placeholder="Describe the overall vibe, lifestyle, rooms, exterior areas, materials, budget, or inspiration for this project..."
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendUserMessage(input);
                    setInput('');
                  }
                }}
                disabled={sending}
              />
              <button
                type="button"
                onClick={() => {
                  sendUserMessage(input);
                  setInput('');
                }}
                disabled={!input.trim() || sending}
                className="shrink-0 w-12 h-12 rounded-2xl bg-[#100f0d] text-[#faf7f1] grid place-items-center hover:bg-[#2a2825] disabled:opacity-35 transition shadow-sm"
                aria-label="Send"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReviewContinue}
                className="btn-ink px-6 py-3 text-[11px] uppercase tracking-[0.15em] disabled:opacity-40"
                disabled={!visionReady || !readiness.ready}
              >
                Review project & spaces
              </button>
              {!visionReady && (
                <span className="text-xs text-[#8b7355]">
                  Share enough detail for your whole-property vision (or combine a shorter note with style chips above).
                </span>
              )}
              {visionReady && (
                <span className="text-xs text-[#8b7355]">
                  {setupNewFlow
                    ? 'Next: review spaces and vision on the confirmation page (guided new projects).'
                    : 'Returns to your project hub — open the editor when you are ready; Space Assistant handles room edits.'}
                </span>
              )}
            </div>
            {!readiness.ready && (
              <div className="rounded-xl border border-sienna-500/35 bg-paper-100/90 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-sienna-700 mb-2">More context needed before confirmation</p>
                <ul className="text-sm text-ink-700 space-y-1">
                  {readiness.missing.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {GUIDED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendUserMessage(q)}
                      disabled={sending}
                      className="text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border border-[rgba(0,0,0,0.1)] bg-[#fffdf9] hover:border-[#004aad]/35 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
