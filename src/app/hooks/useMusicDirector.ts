'use client';

/**
 * hooks/useMusicDirector.ts — which music STATE is playing, decided by where
 * the player is and what the game is doing. The SoundEngine owns HOW (pools of
 * through-composed pieces, shuffle bags, lazy loading, equal-power crossfades,
 * the music-bus EQ, ducking); this file only owns WHEN.
 *
 *   home + lobby                                   → `lobby`
 *   game, ≥3 alive, calm                           → `court`
 *   game, ≥3 alive, someone on their last card
 *     or anyone holding ≥7 coins (a Coup is live)  → `tension`
 *   game, exactly 2 alive (incl. a 1v1 from the start)
 *                                                  → `duel`
 *   game, 2 alive and both on their last card      → `sudden_death`
 *   game, the LOCAL player is out, game goes on    → `fallen`
 *   game over                                      → stop; the win / lose stingers have the room
 *
 * Spectators never match a seat (their `myId` is a spectator id), so they hear
 * the court → tension → duel ladder and never `fallen`.
 *
 * ── HYSTERESIS ─────────────────────────────────────────────────────────────
 * `gameMusicCue()` is the raw answer for one state broadcast; `settleMusicCue()`
 * decides whether to act on it. A coin count bouncing 6 ↔ 7 must not flip the
 * score every turn, so a change is held until the current cue has played for
 * MUSIC_MIN_DWELL_MS (8s) and then re-read — whatever the game says THEN is
 * what plays. Two latches: once in `duel` or `sudden_death` the score never
 * goes back to `court` / `tension` (or from `sudden_death` to `duel`), and once
 * `fallen` it stays `fallen`. `over` is never held.
 *
 * Every call is safe before a gesture: `setMusicState()` only records the
 * choice and `startMusic()` is a no-op until the AudioContext is running, so
 * the first gesture's `unlock()` starts whichever state the scene asked for.
 * The music-enabled setting is the engine's, and both calls respect it.
 *
 * Lobby → game is deliberately NOT a stop and restart: the lobby piece keeps
 * playing across the navigation and the game page's request turns it into a
 * crossfade into the new state's pool — see docs/AUDIO.md.
 */

import { useEffect, useRef, useState } from 'react';
import { getSoundEngine, type MusicState } from '../audio/SoundEngine';
import { COUP_COST } from '@/shared/constants';
import { GameStatus, TurnPhase, type ClientGameState, type ClientPlayerState } from '@/shared/types';

/** Gestures that count as user activation for `AudioContext.resume()`. */
const UNLOCK_EVENTS = ['click', 'touchend', 'keydown'] as const;

/**
 * Unlock audio on the first real gesture, and keep listening until it takes —
 * a `{ once: true }` listener that fires on a gesture the browser does not
 * count (a touchstart on iOS) would leave the page silent for good.
 */
function useUnlockOnGesture(): void {
  useEffect(() => {
    const sound = getSoundEngine();
    const unlock = (): void => {
      sound.unlock();
      if (sound.running) for (const e of UNLOCK_EVENTS) document.removeEventListener(e, unlock);
    };
    for (const e of UNLOCK_EVENTS) document.addEventListener(e, unlock);
    return () => {
      for (const e of UNLOCK_EVENTS) document.removeEventListener(e, unlock);
    };
  }, []);
}

/** Home and lobby: the `lobby` pool. One line per page. */
export function useLobbyMusic(): void {
  useUnlockOnGesture();
  useEffect(() => {
    const sound = getSoundEngine();
    sound.setMusicState('lobby');
    sound.startMusic();
  }, []);
}

export type GameMusicCue = Exclude<MusicState, 'lobby'> | 'over';

function cardsLeft(p: ClientPlayerState): number {
  return p.influences.filter(i => !i.revealed).length;
}

/**
 * What the game page should be playing for this state, before hysteresis.
 * Pure, so it is tested directly.
 */
export function gameMusicCue(gs: ClientGameState | null): GameMusicCue | null {
  if (!gs) return null;
  if (gs.status === GameStatus.Finished || gs.winnerId || gs.turnPhase === TurnPhase.GameOver) return 'over';
  const me = gs.players.find(p => p.id === gs.myId);
  if (me && !me.isAlive) return 'fallen';
  const alive = gs.players.filter(p => p.isAlive);
  if (alive.length <= 2) {
    return alive.length === 2 && alive.every(p => cardsLeft(p) <= 1) ? 'sudden_death' : 'duel';
  }
  const onLastCard = alive.some(p => cardsLeft(p) <= 1);
  const coupOnTheTable = alive.some(p => p.coins >= COUP_COST);
  return onLastCard || coupOnTheTable ? 'tension' : 'court';
}

/** The shortest time a cue plays before the score may change its mind. */
export const MUSIC_MIN_DWELL_MS = 8000;

export interface CueHold {
  readonly cue: GameMusicCue;
  /** Epoch ms the cue started playing. */
  readonly since: number;
}

export interface SettledCue {
  readonly hold: CueHold;
  /** When to re-read the game because a change is being held, or null. */
  readonly retryAt: number | null;
}

/**
 * The cue a state can never return FROM, mapped to the cues it can never
 * return TO. `fallen` is not here: it is handled as "stays fallen".
 */
const LATCHED: Partial<Record<GameMusicCue, readonly GameMusicCue[]>> = {
  duel: ['court', 'tension'],
  sudden_death: ['court', 'tension', 'duel'],
};

/**
 * Hysteresis over `gameMusicCue()`. Pure: `now` is passed in.
 *
 *   - first cue, and `over`, apply at once
 *   - a latched step back (duel/sudden_death → court/tension, sudden_death →
 *     duel, fallen → anything but over) is ignored outright
 *   - any other change waits until the current cue has held MUSIC_MIN_DWELL_MS;
 *     `retryAt` says when to look again
 */
export function settleMusicCue(prev: CueHold | null, raw: GameMusicCue, now: number): SettledCue {
  if (!prev || raw === 'over') {
    return { hold: prev && prev.cue === raw ? prev : { cue: raw, since: now }, retryAt: null };
  }
  if (raw === prev.cue) return { hold: prev, retryAt: null };
  if (prev.cue === 'over') return { hold: { cue: raw, since: now }, retryAt: null };
  if (prev.cue === 'fallen' || LATCHED[prev.cue]?.includes(raw)) return { hold: prev, retryAt: null };
  const ready = prev.since + MUSIC_MIN_DWELL_MS;
  if (now < ready) return { hold: prev, retryAt: ready };
  return { hold: { cue: raw, since: now }, retryAt: null };
}

/**
 * Game page: unlock on the first gesture, then court ↔ tension → duel →
 * sudden death (or fallen) → stop. One line: `useGameMusic(gameState)`.
 *
 * Leaving the page does NOT stop the music. Every page a game can lead to
 * (home, lobby) asks for the lobby pool, and a piece that is still playing
 * turns that request into a crossfade; stopping on unmount would also make
 * React's dev-mode double-mount stop the lobby piece the game page should be
 * crossfading out of.
 */
export function useGameMusic(gameState: ClientGameState | null): void {
  useUnlockOnGesture();
  const raw = gameMusicCue(gameState);
  const gameKey = gameState ? gameState.roomCode : null;
  const turn = gameState?.turnNumber ?? 0;
  const hold = useRef<CueHold | null>(null);
  const lastGame = useRef<{ key: string | null; turn: number }>({ key: null, turn: 0 });
  const [recheck, setRecheck] = useState(0);
  const [cue, setCue] = useState<GameMusicCue | null>(null);

  useEffect(() => {
    if (!raw) return;
    // A new game (another room, or a rematch whose turn counter restarted)
    // drops the latches with the old hold.
    if (lastGame.current.key !== gameKey || turn < lastGame.current.turn) hold.current = null;
    lastGame.current = { key: gameKey, turn };
    const now = Date.now();
    const settled = settleMusicCue(hold.current, raw, now);
    hold.current = settled.hold;
    setCue(settled.hold.cue);
    if (settled.retryAt === null) return;
    const t = window.setTimeout(() => setRecheck(n => n + 1), Math.max(0, settled.retryAt - now) + 20);
    return () => window.clearTimeout(t);
  }, [raw, gameKey, turn, recheck]);

  useEffect(() => {
    if (!cue) return;
    const sound = getSoundEngine();
    if (cue === 'over') {
      // Long enough not to read as a cut under the stinger, short enough to be
      // gone before its cadence.
      sound.stopMusic(1200);
      return;
    }
    sound.setMusicState(cue);
    sound.startMusic();
  }, [cue]);
}
