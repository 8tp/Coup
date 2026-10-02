'use client';

/**
 * hooks/useMusicDirector.ts — which bed is playing, decided by where the player
 * is and what the game is doing. The SoundEngine owns HOW (lazy context,
 * equal-power crossfade, ducking); this file only owns WHEN.
 *
 *   home + lobby          → `lobby`, once a gesture has unlocked audio
 *   game                  → `table`
 *   the final duel        → `endgame`, crossfaded in from `table`
 *   game over             → stop; the win / lose stingers have the room
 *
 * Every call is safe before a gesture: `setMusicTrack()` only records the
 * choice and `startMusic()` is a no-op until the AudioContext is running, so
 * the first gesture's `unlock()` starts whichever bed the scene asked for. The
 * music-enabled setting is the engine's, and both calls respect it.
 *
 * Lobby → game is deliberately NOT a stop and restart. The lobby bed keeps
 * playing across the navigation and the game page's `table` request turns it
 * into a crossfade, which is why all three beds share a key family and a tempo
 * (D minor / A minor, 84 BPM) — see docs/AUDIO.md.
 */

import { useEffect } from 'react';
import { getSoundEngine, type MusicTrack } from '../audio/SoundEngine';
import { GameStatus, TurnPhase, type ClientGameState } from '@/shared/types';

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

/** Home and lobby: the `lobby` bed. One line per page. */
export function useLobbyMusic(): void {
  useUnlockOnGesture();
  useEffect(() => {
    const sound = getSoundEngine();
    sound.setMusicTrack('lobby');
    sound.startMusic();
  }, []);
}

export type GameMusicCue = MusicTrack | 'over';

/**
 * What the game page should be playing for this state. Pure, so it is tested
 * directly.
 *
 * The final duel is "two players left" — but a two-player game starts with
 * two, and spending the whole of it on the tension bed would leave nowhere to
 * go. So a game that began with two switches when the first influence falls.
 */
export function gameMusicCue(gs: ClientGameState | null): GameMusicCue | null {
  if (!gs) return null;
  if (gs.status === GameStatus.Finished || gs.winnerId || gs.turnPhase === TurnPhase.GameOver) return 'over';
  const alive = gs.players.filter(p => p.isAlive);
  if (alive.length <= 2) {
    const startedAsDuel = gs.players.length <= 2;
    const bloodDrawn = gs.players.some(p => p.influences.some(i => i.revealed));
    if (!startedAsDuel || bloodDrawn) return 'endgame';
  }
  return 'table';
}

/**
 * Game page: unlock on the first gesture, then table → endgame → stop. One
 * line: `useGameMusic(gameState)`.
 *
 * Leaving the page does NOT stop the music. Every page a game can lead to
 * (home, lobby) asks for the lobby bed, and a bed that is still playing turns
 * that request into a crossfade; stopping on unmount would also make React's
 * dev-mode double-mount stop the lobby bed the game page should be
 * crossfading out of.
 */
export function useGameMusic(gameState: ClientGameState | null): void {
  useUnlockOnGesture();
  const cue = gameMusicCue(gameState);
  useEffect(() => {
    if (!cue) return;
    const sound = getSoundEngine();
    if (cue === 'over') {
      // Long enough not to read as a cut under the stinger, short enough to be
      // gone before its cadence.
      sound.stopMusic(1200);
      return;
    }
    sound.setMusicTrack(cue);
    sound.startMusic();
  }, [cue]);
}
