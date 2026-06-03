import { useMemo } from 'react';
import clsx from 'clsx';
import { useLayoutStore } from '@/store/layoutStore';
import {
  DEFAULT_ROOM_INTERIOR,
  LAYOUT_INTENTS,
  ROOM_WALLS,
  WALLPAPER_PRESETS,
  WALL_ART_STYLES,
  WALL_COLOR_PRESETS,
  normalizeRoomInterior,
} from '@/data/roomInterior';
import { evaluateLayoutGuidance } from '@/utils/layoutGuidance';

export default function InteriorDesignPanel({
  globalVision = null,
  onApplyVisionLayout = null,
}) {
  const room = useLayoutStore((s) => s.room);
  const furniture = useLayoutStore((s) => s.furniture);
  const updateRoomInterior = useLayoutStore((s) => s.updateRoomInterior);

  const interior = normalizeRoomInterior(room?.interior);
  const roomKnown = Boolean(room?.width && room?.depth);

  const guidance = useMemo(
    () =>
      evaluateLayoutGuidance({
        room,
        furniture,
        layoutIntent: interior.layoutIntent,
      }),
    [room, furniture, interior.layoutIntent],
  );

  const patch = (partial) => updateRoomInterior(partial);

  if (!room) {
    return (
      <div className="p-5 text-sm text-[#5b5b5b]">
        <p className="font-display text-base text-[#171717] mb-2">Interior</p>
        <p className="text-xs">Open a room to customize walls and layout guidance.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      <div>
        <h2 className="font-display text-base text-[#171717]">Interior</h2>
        <p className="mt-1 text-xs leading-relaxed text-[#5b5b5b]">
          Wall finishes, art, and layout intent update the 2D and 3D views.
        </p>
      </div>

      {globalVision && typeof onApplyVisionLayout === 'function' && (
        <section className="rounded-lg border border-[#004aad]/25 bg-[#eef4f7] p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#004aad] mb-2">
            Project vision
          </p>
          <p className="text-[11px] text-[#5b5b5b] mb-3 leading-relaxed">
            Apply your guided vision to this room&apos;s layout, materials (if not manually edited), and
            furniture in empty zones.
          </p>
          <button
            type="button"
            className="btn-ink w-full py-2 text-[10px] uppercase tracking-[0.12em]"
            onClick={() => onApplyVisionLayout({ force: false })}
          >
            Apply Vision to Layout
          </button>
          <button
            type="button"
            className="mt-2 w-full text-[10px] uppercase tracking-[0.12em] text-[#5b5b5b] underline hover:text-[#171717]"
            onClick={() => onApplyVisionLayout({ force: true })}
          >
            Regenerate layout from vision
          </button>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]">Wall color</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Wall color presets">
          {WALL_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              aria-label={preset.label}
              aria-pressed={interior.wallColor === preset.color}
              onClick={() => patch({ wallColor: preset.color })}
              className={clsx(
                'h-8 w-8 rounded-full border-2 transition',
                interior.wallColor === preset.color
                  ? 'border-[#004aad] ring-2 ring-[#004aad]/25'
                  : 'border-[rgba(0,0,0,0.15)] hover:border-[#004aad]/45',
              )}
              style={{ backgroundColor: preset.color }}
            />
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-[#5b5b5b]">
          <span>Custom</span>
          <input
            type="color"
            value={interior.wallColor}
            onChange={(e) => patch({ wallColor: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-[rgba(0,0,0,0.12)] bg-[#fffdf9]"
            aria-label="Custom wall color"
          />
        </label>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]">Wallpaper</h3>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Wallpaper style">
          {WALLPAPER_PRESETS.map((wp) => (
            <ChipButton
              key={wp.id ?? 'none'}
              label={wp.label}
              active={(interior.wallpaperId ?? null) === (wp.id ?? null)}
              onClick={() => patch({ wallpaperId: wp.id })}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]">Wall art</h3>
        <div className="space-y-2">
          <select
            value={interior.wallArt?.styleId ?? ''}
            onChange={(e) => {
              const styleId = e.target.value;
              if (!styleId) {
                patch({ wallArt: null });
                return;
              }
              patch({
                wallArt: {
                  wall: interior.wallArt?.wall ?? 'north',
                  styleId,
                },
              });
            }}
            className="w-full rounded-lg border border-[rgba(0,0,0,0.12)] bg-[#fffdf9] px-2 py-1.5 text-xs"
            aria-label="Wall art style"
          >
            <option value="">None</option>
            {WALL_ART_STYLES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {interior.wallArt && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Wall art placement">
              {ROOM_WALLS.map((w) => (
                <ChipButton
                  key={w.id}
                  label={w.label}
                  active={interior.wallArt?.wall === w.id}
                  onClick={() =>
                    patch({
                      wallArt: { ...interior.wallArt, wall: w.id },
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]">
          Layout intent
        </h3>
        <div className="space-y-1.5">
          {LAYOUT_INTENTS.map((intent) => (
            <button
              key={intent.id}
              type="button"
              onClick={() => patch({ layoutIntent: intent.id })}
              aria-pressed={interior.layoutIntent === intent.id}
              className={clsx(
                'w-full rounded-lg border px-3 py-2 text-left transition',
                interior.layoutIntent === intent.id
                  ? 'border-[#004aad] bg-[#eef4f7]'
                  : 'border-[rgba(0,0,0,0.08)] bg-[#fffdf9] hover:border-[#004aad]/35',
              )}
            >
              <span className="block text-xs font-medium text-[#171717]">{intent.label}</span>
              <span className="mt-0.5 block text-[11px] text-[#5b5b5b]">{intent.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section
        className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] p-3"
        data-testid="layout-guidance-panel"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]">
            Layout guidance
          </h3>
          {roomKnown && (
            <span className="text-[10px] font-medium text-[#004aad]">{guidance.score}/100</span>
          )}
        </div>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-[#5b5b5b]">
          {guidance.tips.map((tip) => (
            <li key={tip} className="text-[#171717]">
              ✓ {tip}
            </li>
          ))}
          {guidance.warnings.map((warn) => (
            <li key={warn} className="text-[#8b4513]">
              ! {warn}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => patch({ ...DEFAULT_ROOM_INTERIOR })}
        className="text-[10px] uppercase tracking-[0.12em] text-[#5b5b5b] underline hover:text-[#171717]"
      >
        Reset interior to defaults
      </button>
    </div>
  );
}

function ChipButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition',
        active
          ? 'border-[#004aad] bg-[#eef4f7] text-[#004aad]'
          : 'border-[rgba(0,0,0,0.12)] bg-[#fffdf9] text-[#5b5b5b] hover:border-[#004aad]/35',
      )}
    >
      {label}
    </button>
  );
}
