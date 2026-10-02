'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ClientGameState } from '@/shared/types';
import { getPracticeCoachTip, type CoachAnchor, type CoachHistory } from '../../utils/practiceCoach';
import {
  isEmptyRect,
  placeDockBanner,
  placePointedCallout,
  type CalloutPlacement,
  type Rect,
} from '../../utils/coachPlacement';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useGameStore } from '../../stores/gameStore';
import { useIsomorphicLayoutEffect } from '../../anim';
import { haptic } from '../../utils/haptic';

/**
 * THE PRACTICE COACH, AS A CALLOUT ON THE TABLE.
 *
 * It used to be a banner across the top of the screen, reading about a
 * button somewhere else. Now each tip names the part of the table it is about
 * (`tip.anchor`, utils/practiceCoach.ts) and the callout points at it:
 *
 *   desktop (≥1024px)  a panel beside the anchor with a brass pointer, placed
 *                      on whichever side covers no control (coachPlacement.ts)
 *   phone / tablet     a compact banner docked just above the bottom sheet,
 *                      where the buttons it talks about live
 *
 * The anchor registry is nothing but attributes: `data-coach-anchor="dock" |
 * "prompt" | "plaque" | "hand" | "sheet"` on the court table's own elements,
 * measured with getBoundingClientRect on every state change, resize, scroll
 * and anchor resize. If no clean spot exists the tip waits rather than cover
 * a button.
 */

interface PracticeCoachProps {
  gameState: ClientGameState;
  onOpenRules: () => void;
}

const HIDDEN_KEY = 'coup_practice_coach_hidden';
const DISMISSED_KEY = 'coup_practice_coach_dismissed';
const HISTORY_KEY = 'coup_practice_coach_seen';

/** Re-measure after the table's own entrances settle (plaque-land is 280ms). */
const SETTLE_MS = [60, 320, 700];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

function toRect(el: Element | null | undefined): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  return isEmptyRect(rect) ? null : rect;
}

function anchorEl(name: CoachAnchor | 'sheet'): Element | null {
  return document.querySelector(`[data-coach-anchor="${name}"]`);
}

/** The anchor to point at, falling back to the dock and then the hand when it is not on screen. */
function resolveAnchor(preferred: CoachAnchor): { name: CoachAnchor; el: Element; rect: Rect } | null {
  const order: CoachAnchor[] = [preferred, 'dock', 'prompt', 'hand'];
  for (const name of order) {
    const el = anchorEl(name);
    const rect = toRect(el);
    if (el && rect) return { name, el, rect };
  }
  return null;
}

function rectsOf(selector: string): Rect[] {
  return Array.from(document.querySelectorAll(selector)).map(toRect).filter((r): r is Rect => r !== null);
}

export function PracticeCoach({ gameState, onOpenRules }: PracticeCoachProps) {
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [history, setHistory] = useState<CoachHistory>(() => new Map());
  const [placement, setPlacement] = useState<CalloutPlacement | null>(null);
  const calloutRef = useRef<HTMLElement>(null);
  const docked = useMediaQuery('(max-width: 1023px)');
  // The challenge reveal is the table's own moment; the coach steps aside.
  const revealing = useGameStore(s => s.challengeReveal !== null);

  useEffect(() => {
    setHidden(sessionStorage.getItem(HIDDEN_KEY) === 'true');
    setDismissed(new Set(readJson<string[]>(DISMISSED_KEY, [])));
    setHistory(new Map(readJson<Array<[string, number]>>(HISTORY_KEY, [])));
  }, []);

  const tip = useMemo(() => getPracticeCoachTip(gameState, history), [gameState, history]);
  const visibleTip = hidden === false && !revealing && tip && !dismissed.has(tip.id) ? tip : null;

  // A first-time tip is recorded the turn it is first shown, so it stays up
  // for that turn and never comes back (see CoachHistory).
  useEffect(() => {
    if (!visibleTip?.once || history.has(visibleTip.id)) return;
    const next = new Map(history).set(visibleTip.id, gameState.turnNumber);
    setHistory(next);
    writeJson(HISTORY_KEY, Array.from(next.entries()));
  }, [visibleTip, history, gameState.turnNumber]);

  const place = useCallback(() => {
    const el = calloutRef.current;
    if (!el || !visibleTip) return;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    const anchor = resolveAnchor(visibleTip.anchor);
    const header = toRect(document.querySelector('.court-header'));
    const seats = rectsOf('.court-seat');
    const aimedSeats = rectsOf('.court-seat.is-selectable, .court-seat.is-illegal');
    const sheet = toRect(anchorEl('sheet'));

    let next: CalloutPlacement | null = null;
    if (docked) {
      // The banner sits above the sheet, so everything inside the sheet is
      // safe by construction; what it must not cover is the anchor when the
      // anchor lives on the felt (the claim plaque), or a seat being aimed at.
      const anchorOnFelt = anchor && (!sheet || anchor.rect.top + anchor.rect.height <= sheet.top);
      const seatsBottom = seats.reduce((max, r) => Math.max(max, r.top + r.height), 0);
      next = placeDockBanner({
        sheetTop: sheet?.top ?? viewport.height,
        topLimit: header ? header.top + header.height : 0,
        size,
        viewport,
        avoid: [...(anchorOnFelt ? [anchor.rect] : []), ...aimedSeats],
        soft: [...seats, ...rectsOf('[data-coach-anchor="plaque"], .court-phase')],
        extraTops: seatsBottom > 0 ? [seatsBottom + 8] : [],
      });
    } else if (anchor) {
      const controls = (['dock', 'prompt', 'plaque', 'hand'] as const)
        .filter(name => name !== anchor.name)
        .map(name => toRect(anchorEl(name)))
        .filter((r): r is Rect => r !== null);
      const avoid = [...controls, ...seats, ...rectsOf('.court-dock-log, .court-header-actions')];
      const soft = rectsOf('.court-phase, .court-objects .table-object, .court-discard');
      next = placePointedCallout({ anchor: anchor.rect, size, viewport, avoid, soft })
        ?? placeDockBanner({
          sheetTop: sheet?.top ?? viewport.height,
          topLimit: header ? header.top + header.height : 0,
          size,
          viewport,
          maxWidth: size.width,
          avoid: [anchor.rect, ...controls, ...seats],
        });
    }

    setPlacement(prev => (
      prev && next
        && Math.abs(prev.left - next.left) < 0.5
        && Math.abs(prev.top - next.top) < 0.5
        && prev.side === next.side
        && prev.pointer === next.pointer
        && prev.reach === next.reach
        ? prev
        : next
    ));
  }, [docked, visibleTip]);

  // Measure on every state change, then again as the table's entrances settle.
  useIsomorphicLayoutEffect(() => {
    if (!visibleTip) { setPlacement(null); return; }
    place();
    const timers = SETTLE_MS.map(ms => setTimeout(place, ms));
    return () => timers.forEach(clearTimeout);
  }, [place, visibleTip, gameState]);

  // …and whenever the room moves under it.
  useEffect(() => {
    if (!visibleTip) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (observer) {
      for (const name of [visibleTip.anchor, 'sheet'] as const) {
        const el = anchorEl(name);
        if (el) observer.observe(el);
      }
      if (calloutRef.current) observer.observe(calloutRef.current);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      observer?.disconnect();
    };
  }, [place, visibleTip]);

  if (!visibleTip) return null;

  const dismissTip = () => {
    haptic();
    const next = new Set(dismissed).add(visibleTip.id);
    setDismissed(next);
    writeJson(DISMISSED_KEY, Array.from(next));
  };

  const hideCoach = () => {
    haptic();
    sessionStorage.setItem(HIDDEN_KEY, 'true');
    setHidden(true);
  };

  const style: CSSProperties = placement
    ? {
        left: placement.left,
        top: placement.top,
        ['--pointer' as string]: placement.pointer !== null ? `${placement.pointer}px` : undefined,
        ['--reach' as string]: `${placement.reach}px`,
      }
    : { left: 0, top: 0 };

  return (
    <aside
      ref={calloutRef}
      key={visibleTip.id}
      className="coach-callout"
      data-tip={visibleTip.id}
      data-mode={docked ? 'dock' : 'point'}
      data-side={placement?.side ?? 'none'}
      data-tone={visibleTip.tone}
      data-placed={placement ? 'true' : 'false'}
      style={style}
      aria-label="Practice coach"
      aria-hidden={placement ? undefined : true}
    >
      {placement && placement.side !== 'dock' && (
        <>
          {placement.reach > 0 && <span className="coach-leader" aria-hidden="true" />}
          <span className="coach-pointer" aria-hidden="true" />
        </>
      )}
      <div className="coach-head">
        <span className="coach-label">Coach</span>
        <span className="coach-controls">
          <button type="button" className="coach-btn coach-got" onClick={dismissTip}>Got it</button>
          <button type="button" className="coach-btn" onClick={hideCoach}>Hide tips</button>
        </span>
      </div>
      <div role="status" aria-live="polite">
        <p className="coach-title type-display">{visibleTip.title}</p>
        <p className="coach-body">{visibleTip.body}</p>
      </div>
      {!docked && (
        <button type="button" className="coach-rules" onClick={() => { haptic(); onOpenRules(); }}>
          Check the rules
        </button>
      )}
    </aside>
  );
}
