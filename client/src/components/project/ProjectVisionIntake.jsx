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
} from '@/utils/projectVision';
import {
  applyRoomFocusSelection,
  buildChatGlobalVisionPayload,
  buildGuidedStepSummaryText,
  evaluateGuidedVisionReadiness,
  getActiveGuidedVisionStep,
  getFocusedSpaceForVision,
  getOptionsForGuidedStep,
  GUIDED_VISION_STEP_PROMPTS,
  NO_MAJOR_CONSTRAINTS,
  normalizeGuidedVisionFields,
  toggleGuidedListSelection,
  toggleRoomSpecificNeed,
  USE_ALL_ROOMS_EVENLY,
} from '@/utils/guidedVisionFlow';
import { isProjectVisionComplete } from '@/utils/visionGate';
import {
  buildVisionSaveStatusMessage,
  dedupeAssistantFallbackMessages,
  normalizeVisionIntakeThread,
  upsertAssistantStatusMessage,
  upsertGuidedStepSummaryMessage,
} from '@/utils/projectVisionIntakeChat';

function buildDeterministicVisionSuggestions(globalVision) {
  const styles = Array.isArray(globalVision?.moodTags) ? globalVision.moodTags : [];
  const vibe = styles[0] ? `Lean into a ${styles[0]} feeling` : 'Pick at least two style directions';
  const styleLine =
    styles.length > 0
      ? `Carry these through the layout: ${styles.slice(0, 3).join(', ')}.`
      : 'Use the style chips to set the overall mood.';
  const priorities = Array.isArray(globalVision?.priorities) ? globalVision.priorities : [];
  const priorityLine =
    priorities.length > 0
      ? `Prioritize: ${priorities.slice(0, 3).join(', ')}.`
      : 'Choose two layout priorities that matter most.';
  return [vibe, styleLine, priorityLine];
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
    "Let's shape your whole-property direction — tap the options below one step at a time. You can add a short note anytime.";
  if (!spaces?.length) {
    return `${base}\n\nNo spaces are listed yet — you can still set direction here, then review spaces on the next step.`;
  }
  const names = spaces.map((s) => s.name).join(', ');
  return `${base}\n\nSpaces in this project: ${names}.`;
}

const CHECKLIST_LABELS = {
  style: 'Style direction',
  priorities: 'Layout priorities',
  constraints: 'Constraints',
  roomFocus: 'Room focus',
  roomNeeds: 'Room-specific needs',
};

export default function ProjectVisionIntake({ project, onPersist }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setupNewFlow = searchParams.get('setup') === 'new';
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const themeMergedRef = useRef(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [optionalNote, setOptionalNote] = useState('');
  const [persistTick, setPersistTick] = useState(0);

  const spacesContext = useMemo(
    () => buildSpacesContextFromProject(project),
    [project?.id, project?.spaces],
  );

  const gv = useMemo(
    () => normalizeGlobalVision(project?.globalVision || {}, project),
    [project?.globalVision, project],
  );

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
    setOptionalNote(gv.notes || '');
  }, [project?.id, gv.notes]);

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

  const persistFull = (nextMessages, patch) => {
    const p = getProjectById(project.id) || project;
    if (!p?.id) return;
    const thread = nextMessages
      .filter((m) => m.id !== 'welcome')
      .map(({ id, role, content, type }) => ({ id, role, content, ...(type ? { type } : {}) }));
    const normalized = prepareGlobalVisionForSave(
      { ...patch, visionIntakeThread: thread, spacesContext },
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
    setPersistTick((t) => t + 1);
    return normalized;
  };

  const liveGv = useMemo(
    () =>
      normalizeGlobalVision(
        getProjectById(project?.id)?.globalVision || project?.globalVision || gv,
        project,
      ),
    [gv, project, project?.globalVision, persistTick],
  );

  const fields = useMemo(() => normalizeGuidedVisionFields(liveGv), [liveGv]);
  const activeStep = useMemo(
    () => getActiveGuidedVisionStep(liveGv, project),
    [liveGv, project],
  );
  const readiness = useMemo(
    () => evaluateGuidedVisionReadiness(liveGv, project),
    [liveGv, project],
  );
  const stepOptions = useMemo(
    () => getOptionsForGuidedStep(activeStep, project, liveGv),
    [activeStep, project, liveGv],
  );
  const focusedSpace = useMemo(
    () => getFocusedSpaceForVision(project, fields),
    [project, fields],
  );

  const isChipSelected = (label) => {
    const key = label.toLowerCase();
    switch (activeStep) {
      case 'mood':
        return fields.moodTags.some((t) => t.toLowerCase() === key);
      case 'priorities':
        return fields.priorities.some((t) => t.toLowerCase() === key);
      case 'constraints':
        return fields.constraints.some((t) => t.toLowerCase() === key);
      case 'room_focus':
        if (label === USE_ALL_ROOMS_EVENLY) return fields.useAllRoomsEvenly;
        return fields.prioritizedRooms.some((t) => t.toLowerCase() === key);
      case 'room_needs': {
        if (!focusedSpace) return false;
        return (fields.roomSpecificNeeds[focusedSpace.id] || []).some(
          (t) => t.toLowerCase() === key,
        );
      }
      default:
        return false;
    }
  };

  const applyGuidedSelection = (label) => {
    if (!project || activeStep === 'complete') return;
    const p0 = getProjectById(project.id) || project;
    const g0 = normalizeGlobalVision(p0.globalVision || {}, p0);

    let patchFields;
    if (activeStep === 'mood') {
      patchFields = toggleGuidedListSelection(g0, label, 'mood');
    } else if (activeStep === 'priorities') {
      patchFields = toggleGuidedListSelection(g0, label, 'priorities');
    } else if (activeStep === 'constraints') {
      patchFields = toggleGuidedListSelection(g0, label, 'constraints');
    } else if (activeStep === 'room_focus') {
      patchFields = applyRoomFocusSelection(g0, label);
    } else if (activeStep === 'room_needs' && focusedSpace) {
      patchFields = toggleRoomSpecificNeed(g0, focusedSpace, label);
    } else {
      return;
    }

    const nextGv = prepareGlobalVisionForSave(
      {
        moodTags: patchFields.moodTags,
        priorities: patchFields.priorities,
        constraints: patchFields.constraints,
        prioritizedRooms: patchFields.prioritizedRooms,
        roomSpecificNeeds: patchFields.roomSpecificNeeds,
        useAllRoomsEvenly: patchFields.useAllRoomsEvenly,
        styleKeywords: patchFields.moodTags,
        notes: optionalNote.trim(),
      },
      g0,
      p0,
    );

    const summaryText = buildGuidedStepSummaryText(activeStep, nextGv, p0);
    const withSummary = upsertGuidedStepSummaryMessage(messages, summaryText);
    setMessages(withSummary);
    persistFull(withSummary, nextGv);
  };

  const handleOptionalNoteBlur = () => {
    const trimmed = optionalNote.trim();
    if (trimmed === (liveGv.notes || '').trim()) return;
    persistFull(messages, { notes: trimmed });
  };

  const sendUserMessage = async (text) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed || !project) return;

    const p0 = getProjectById(project.id) || project;
    const g0 = normalizeGlobalVision(p0.globalVision || {}, p0);
    const nextGv = prepareGlobalVisionForSave({ notes: optionalNote.trim() || trimmed }, g0, p0);
    const globalVisionPayload = buildChatGlobalVisionPayload(
      { ...nextGv, notes: trimmed },
      p0,
    );

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    persistFull(nextMessages, { ...nextGv, notes: trimmed });

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
        global_vision: globalVisionPayload,
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
          { ...nextGv, notes: trimmed },
          p0,
        ),
      );
    } catch {
      toast.error('Could not reach the assistant. Your choices are saved — try again in a moment.');
      const bullets = buildDeterministicVisionSuggestions(globalVisionPayload);
      const statusMsg = buildVisionSaveStatusMessage(bullets);
      const withStatus = upsertAssistantStatusMessage(nextMessages, statusMsg);
      setMessages(withStatus);
      persistFull(withStatus, { ...nextGv, notes: trimmed });
    } finally {
      setSending(false);
    }
  };

  const visionReady = isProjectVisionComplete(liveGv, project);
  const continueLabel = setupNewFlow ? 'Review Project & Spaces' : 'Continue to Studio';

  const handleReviewContinue = () => {
    if (!project) return;
    if (!visionReady) {
      toast.error(readiness.helperText || 'Complete the checklist above to continue.');
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
            notes: optionalNote.trim(),
          },
          liveGv,
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
              Tap options to set style, priorities, and room focus — no long form required.
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
            {activeStep !== 'complete' && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">
                  {GUIDED_VISION_STEP_PROMPTS[activeStep]}
                </p>
                {activeStep === 'room_needs' && focusedSpace && (
                  <p className="text-xs text-[#5b5b5b] mb-2">
                    For <span className="font-medium text-[#171717]">{focusedSpace.name}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {stepOptions.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => applyGuidedSelection(chip)}
                      className={`text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border transition ${
                        isChipSelected(chip)
                          ? 'border-[#004aad] bg-[#eef4f7] text-[#004aad]'
                          : 'border-[rgba(0,0,0,0.1)] text-[#5b5b5b] hover:border-[#004aad]/40'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Optional note</p>
              <textarea
                className="w-full bg-[#fffdf9] border border-[rgba(0,0,0,0.1)] rounded-2xl px-4 py-3 text-sm text-[#171717] placeholder:text-[#9a9a9a] resize-none focus:outline-none focus:border-[#004aad]/45 focus:ring-2 focus:ring-[#004aad]/10 min-h-[44px]"
                placeholder="Optional: add one sentence, like 'make the living room good for hosting.'"
                rows={2}
                value={optionalNote}
                onChange={(e) => setOptionalNote(e.target.value)}
                onBlur={handleOptionalNoteBlur}
              />
            </div>

            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-[#fffdf9] border border-[rgba(0,0,0,0.1)] rounded-2xl px-4 py-3 text-sm text-[#171717] placeholder:text-[#9a9a9a] resize-none focus:outline-none focus:border-[#004aad]/45 focus:ring-2 focus:ring-[#004aad]/10 min-h-[44px] max-h-[120px]"
                placeholder="Ask the assistant anything (optional)"
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

            <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Readiness</p>
              <ul className="space-y-1.5">
                {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
                  const done = readiness.checklist[key];
                  if (key === 'roomFocus' && readiness.spaces.length === 0) return null;
                  if (key === 'roomNeeds' && readiness.spaces.length === 0) return null;
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                          done
                            ? 'border-[#004aad] bg-[#004aad] text-white'
                            : 'border-[rgba(0,0,0,0.15)] text-transparent'
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className={done ? 'text-[#171717]' : 'text-[#8b7355]'}>{label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReviewContinue}
                className="btn-ink px-6 py-3 text-[11px] uppercase tracking-[0.15em] disabled:opacity-40"
                disabled={!visionReady || sending}
              >
                {continueLabel}
              </button>
              <span className={`text-xs ${visionReady ? 'text-[#5b5b5b]' : 'text-[#8b7355]'}`}>
                {readiness.helperText}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
