import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import MessageBubble from '@/components/chatbot/MessageBubble';
import { getProjectById, upsertProject } from '@/utils/projectCompat';
import {
  buildSpacesContextFromProject,
  normalizeGlobalVision,
  prepareGlobalVisionForSave,
  PROJECT_VISION_MOOD_CHIPS,
  PROJECT_VISION_PRIORITY_KEYWORDS,
  tagsFromChips,
} from '@/utils/projectVision';
import { isProjectVisionComplete } from '@/utils/visionGate';
import {
  buildVisionSaveStatusMessage,
  dedupeAssistantFallbackMessages,
  normalizeVisionIntakeThread,
  upsertAssistantStatusMessage,
} from '@/utils/projectVisionIntakeChat';

const GUIDED_QUESTIONS = [
  'What feeling should guests have when they enter?',
  'Which spaces matter most day to day?',
  'Should the exterior match the interior direction?',
];

function buildDeterministicVisionSuggestions(globalVision) {
  const styles = Array.isArray(globalVision?.styleKeywords) ? globalVision.styleKeywords : [];
  const vibe = globalVision?.moodVibe ? `Focus on a ${globalVision.moodVibe} mood` : 'Define one clear mood';
  const styleLine =
    styles.length > 0
      ? `Use this style direction consistently: ${styles.slice(0, 3).join(', ')}.`
      : 'Pick a few style chips above (Warm, Coastal, Minimal, etc.).';
  const budget =
    globalVision?.budgetRange
      ? `Keep selections aligned to budget: ${globalVision.budgetRange}.`
      : 'Set a budget range to guide furniture and material tradeoffs.';
  return [vibe, styleLine, budget];
}

function getVisionReadiness(globalVision, scope = 'interior_exterior') {
  const text = (globalVision?.summary || globalVision?.propertyVision || '').trim();
  const hasVisionText = text.length >= 40;
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
  if (!hasVisionText && !hasStyleMood) {
    missing.push('Choose a few style chips or tell the assistant your overall direction.');
  }
  if (!hasPurposeSignal && !hasStyleMood) missing.push('Mention who uses the property or pick family/hosting chips.');
  if (wantsInterior && !hasInteriorGoal && !hasStyleMood) {
    missing.push('Mention an interior priority or a room type you care about.');
  }
  if (wantsExterior && !hasExteriorGoal && scope === 'interior_exterior' && !hasStyleMood) {
    missing.push('Mention an exterior goal if outdoor areas matter.');
  }

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

function buildWelcomeMessage(spaces) {
  const base =
    "I found your project spaces. Let's define the overall feeling, priorities, and constraints before editing individual rooms.";
  if (!spaces?.length) {
    return `${base}\n\nNo spaces are listed yet — you can still set direction here, then review spaces on the next step.`;
  }
  const names = spaces.map((s) => s.name).join(', ');
  return `${base}\n\nSpaces in this project: ${names}.`;
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

  const spacesContext = useMemo(
    () => buildSpacesContextFromProject(project),
    [project?.id, project?.spaces],
  );

  const gv = useMemo(
    () => normalizeGlobalVision(project?.globalVision || {}, project),
    [project?.globalVision, project],
  );

  const [selectedChips, setSelectedChips] = useState(() => {
    const fromKeywords = new Set((gv.moodTags || []).map((k) => String(k).toLowerCase()));
    const picked = new Set();
    PROJECT_VISION_MOOD_CHIPS.forEach((c) => {
      if (fromKeywords.has(c.toLowerCase())) picked.add(c);
    });
    return picked;
  });

  const [messages, setMessages] = useState(() => {
    const saved = normalizeVisionIntakeThread(gv.visionIntakeThread);
    if (saved.length > 0) return saved;
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: buildWelcomeMessage(spacesContext),
      },
    ];
  });

  useEffect(() => {
    if (!project || themeMergedRef.current) return;
    const themePrompt = project.theme?.prompt?.trim();
    const chips = project.theme?.styleChips || [];
    if (!themePrompt && chips.length === 0) return;
    themeMergedRef.current = true;
    const nextGv = prepareGlobalVisionForSave(
      {
        summary: gv.summary || themePrompt,
        moodTags: [...(gv.moodTags || []), ...chips],
      },
      gv,
      project,
    );
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
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, [messages, sending]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const persistFull = (nextMessages, nextGv) => {
    const p = getProjectById(project.id) || project;
    if (!p?.id) return;
    const thread = nextMessages
      .filter((m) => m.id !== 'welcome')
      .map(({ id, role, content, type }) => ({ id, role, content, ...(type ? { type } : {}) }));
    const normalized = prepareGlobalVisionForSave(
      { ...nextGv, visionIntakeThread: thread, spacesContext },
      p.globalVision || {},
      p,
    );
    const next = {
      ...p,
      globalVision: normalized,
      updatedAt: new Date().toISOString(),
    };
    upsertProject(next);
    onPersist?.(next);
  };

  const applyChipSelection = (chipSet) => {
    const { moodTags, priorities } = tagsFromChips(chipSet, PROJECT_VISION_PRIORITY_KEYWORDS);
    const p0 = getProjectById(project.id) || project;
    const g0 = normalizeGlobalVision(p0.globalVision || {}, p0);
    let summary = g0.summary || '';
    if (!summary && moodTags.length > 0) {
      summary = `Whole-property direction: ${moodTags.slice(0, 5).join(', ')}.`;
    }
    persistFull(
      messages,
      prepareGlobalVisionForSave({ summary, moodTags, priorities, styleKeywords: moodTags }, g0, p0),
    );
  };

  const toggleChip = (chip) => {
    setSelectedChips((prev) => {
      const n = new Set(prev);
      if (n.has(chip)) n.delete(chip);
      else n.add(chip);
      applyChipSelection(n);
      return n;
    });
  };

  const sendUserMessage = async (text) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed || !project) return;

    const p0 = getProjectById(project.id) || project;
    const g0 = normalizeGlobalVision(p0.globalVision || {}, p0);

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    const { moodTags, priorities } = tagsFromChips(
      new Set(Array.from(selectedChips)),
      PROJECT_VISION_PRIORITY_KEYWORDS,
    );
    let summary = g0.summary || '';
    if (trimmed.length >= 48 && !summary) {
      summary = trimmed;
    } else if (!summary && moodTags.length > 0) {
      summary = `Whole-property direction: ${moodTags.slice(0, 5).join(', ')}.`;
    }
    const nextGv = prepareGlobalVisionForSave(
      {
        summary: summary || g0.summary,
        notes: trimmed,
        moodTags,
        priorities,
        styleKeywords: moodTags,
      },
      g0,
      p0,
    );
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
      persistFull(
        withAssistant,
        prepareGlobalVisionForSave(
          { visionIntakeAssistantSummary: assistantText.slice(0, 2000) },
          nextGv,
          p0,
        ),
      );
    } catch {
      toast.error('Could not reach the assistant. Your choices are saved — try again in a moment.');
      const bullets = buildDeterministicVisionSuggestions(nextGv);
      const statusMsg = buildVisionSaveStatusMessage(bullets);
      const withStatus = upsertAssistantStatusMessage(nextMessages, statusMsg);
      setMessages(withStatus);
      persistFull(withStatus, nextGv);
    } finally {
      setSending(false);
    }
  };

  const effectiveGv = useMemo(
    () =>
      normalizeGlobalVision(
        {
          ...gv,
          styleKeywords: [...Array.from(selectedChips)],
          moodTags: [...Array.from(selectedChips)],
        },
        project,
      ),
    [gv, selectedChips, project],
  );

  const visionReady = isProjectVisionComplete(effectiveGv);
  const readiness = useMemo(
    () => getVisionReadiness(effectiveGv, project?.scope || 'interior_exterior'),
    [effectiveGv, project?.scope],
  );

  const handleReviewContinue = () => {
    if (!project) return;
    if (!visionReady || !readiness.ready) {
      toast.error('Choose a few style directions or share a short note with the assistant first.');
      return;
    }
    try {
      const next = {
        ...project,
        globalVision: prepareGlobalVisionForSave(
          {
            visionIntakeThread: dedupeAssistantFallbackMessages(
              messages.filter((m) => m.id !== 'welcome'),
            ).map(({ id, role, content, type }) => ({
              id,
              role,
              content,
              ...(type ? { type } : {}),
            })),
          },
          effectiveGv,
          project,
        ),
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
    } catch {
      toast.error('Could not save project vision. Please try again.');
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-vs-accent mb-3">
              Whole-property planning
            </p>
            <h1 className="font-display text-[clamp(1.75rem,4vw,2.35rem)] font-medium leading-tight tracking-[-0.02em]">
              Project Vision Assistant
            </h1>
            <p className="mt-4 text-sm text-[#5b5b5b] max-w-2xl leading-relaxed">
              I&apos;ll use your rooms as context and help shape the whole-property direction.
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-3xl px-6 md:px-8 pb-6">
          {spacesContext.length > 0 && (
            <div className="mt-4 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] px-4 py-3 shrink-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Project spaces</p>
              <div className="flex flex-wrap gap-2">
                {spacesContext.map((space) => (
                  <span
                    key={space.id}
                    className="text-[10px] uppercase tracking-editorial px-2.5 py-1 rounded-full border border-[#004aad]/20 bg-[#eef4f7] text-[#004aad]"
                  >
                    {space.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-4 min-h-0">
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
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Quick direction</p>
              <div className="flex flex-wrap gap-2">
                {PROJECT_VISION_MOOD_CHIPS.map((chip) => (
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

            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-[#fffdf9] border border-[rgba(0,0,0,0.1)] rounded-2xl px-4 py-3 text-sm text-[#171717] placeholder:text-[#9a9a9a] resize-none focus:outline-none focus:border-[#004aad]/45 focus:ring-2 focus:ring-[#004aad]/10 min-h-[44px] max-h-[120px]"
                placeholder="Tell me anything specific, or choose options above."
                rows={1}
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
                disabled={!visionReady || !readiness.ready || sending}
              >
                Review project & spaces
              </button>
              {!visionReady && (
                <span className="text-xs text-[#8b7355]">
                  Pick a few chips or send a short note — no long form required.
                </span>
              )}
            </div>
            {!readiness.ready && (
              <div className="rounded-xl border border-sienna-500/35 bg-paper-100/90 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-sienna-700 mb-2">A little more context helps</p>
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
