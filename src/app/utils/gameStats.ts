import { LogEntry, ClientGameState } from '@/shared/types';
// Type-only: erased at compile time, so this module stays React-free.
import type { AwardGlyphKey } from './logGlyphs';

/**
 * Numbers about a finished game, read from the log's structured fields
 * (event types, actor ids, `wasBluff`), never from its English text. The
 * sentences built from them are in components/game/gameover/summary.ts.
 */
export interface PlayerStats {
  playerId: string;
  playerName: string;
  challengesMade: number;
  challengesWon: number;
  challengesLost: number;
  timesCaughtBluffing: number;
  timesProvenHonest: number;
  blocksMade: number;
  coupsMade: number;
  assassinationsMade: number;
  actionsClaimed: number;
  actualBluffs: number;
  eliminationOrder: number; // 0 = not eliminated, 1 = first out, etc.
}

/**
 * Every award, by stable id. The id is what lifetime stats store and what
 * the catalogs key on (`gameover.awardTitle.<id>`, `gameover.awardLine.<id>`,
 * `stats.awardCriterion.<id>`); the names on screen are translations.
 * In the order the stats modal lists them.
 */
export const AWARD_IDS = [
  'pantsOnFire',
  'honestAbe',
  'inquisitor',
  'eagleEye',
  'wall',
  'smoothOperator',
  'coupMachine',
  'silentAssassin',
  'boldStrategy',
  'quickExit',
] as const;

export type AwardId = typeof AWARD_IDS[number];

export const AWARD_GLYPH: Record<AwardId, AwardGlyphKey> = {
  pantsOnFire: 'bluff',
  honestAbe: 'truth',
  inquisitor: 'challenge',
  eagleEye: 'target',
  wall: 'block',
  smoothOperator: 'claim',
  coupMachine: 'coup',
  silentAssassin: 'assassinate',
  boldStrategy: 'dice',
  quickExit: 'exit',
};

export function isAwardId(value: unknown): value is AwardId {
  return typeof value === 'string' && (AWARD_IDS as readonly string[]).includes(value);
}

export interface Award {
  id: AwardId;
  /** Key into AWARD_GLYPHS; the render site resolves it to a glyph component. */
  glyph: AwardGlyphKey;
  playerId: string;
  /** The numbers in the award's line (`gameover.awardLine.<id>`), besides the player. */
  params: Readonly<Record<string, number>>;
}

export function computePlayerStats(log: LogEntry[], playerIds: string[], playerNames: Map<string, string> = new Map()): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();

  for (const id of playerIds) {
    stats.set(id, {
      playerId: id,
      playerName: playerNames.get(id) ?? id,
      challengesMade: 0,
      challengesWon: 0,
      challengesLost: 0,
      timesCaughtBluffing: 0,
      timesProvenHonest: 0,
      blocksMade: 0,
      coupsMade: 0,
      assassinationsMade: 0,
      actionsClaimed: 0,
      actualBluffs: 0,
      eliminationOrder: 0,
    });
  }

  let eliminationCounter = 0;

  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    const id = entry.actorId;
    if (!id) continue;
    const s = stats.get(id);
    if (!s) continue;

    switch (entry.eventType) {
      case 'claim_action':
        s.actionsClaimed++;
        if (entry.wasBluff) s.actualBluffs++;
        break;
      case 'challenge':
      case 'block_challenge':
        s.challengesMade++;
        break;
      case 'challenge_success':
      case 'block_challenge_success':
        // actorId = the challenger who won
        s.challengesWon++;
        // Find who was bluffing by scanning backwards
        if (entry.eventType === 'challenge_success') {
          // The bluffer is the preceding claim_action's actor
          for (let j = i - 1; j >= 0; j--) {
            if (log[j].eventType === 'claim_action' && log[j].actorId) {
              const bluffer = stats.get(log[j].actorId!);
              if (bluffer) bluffer.timesCaughtBluffing++;
              break;
            }
          }
        } else {
          // block_challenge_success: the bluffer is the preceding block's actor
          for (let j = i - 1; j >= 0; j--) {
            if (log[j].eventType === 'block' && log[j].actorId) {
              const bluffer = stats.get(log[j].actorId!);
              if (bluffer) bluffer.timesCaughtBluffing++;
              break;
            }
          }
        }
        break;
      case 'challenge_fail':
      case 'block_challenge_fail':
        // actorId = the challenged player who was proven honest
        s.timesProvenHonest++;
        // The challenger who lost: scan backwards for challenge/block_challenge
        {
          const challengeType = entry.eventType === 'challenge_fail' ? 'challenge' : 'block_challenge';
          for (let j = i - 1; j >= 0; j--) {
            if (log[j].eventType === challengeType && log[j].actorId) {
              const challenger = stats.get(log[j].actorId!);
              if (challenger) challenger.challengesLost++;
              break;
            }
          }
        }
        break;
      case 'block':
        s.blocksMade++;
        if (entry.wasBluff) s.actualBluffs++;
        break;
      case 'coup':
        s.coupsMade++;
        break;
      case 'assassination':
        s.assassinationsMade++;
        break;
      case 'elimination':
        eliminationCounter++;
        s.eliminationOrder = eliminationCounter;
        break;
    }
  }

  return stats;
}

function selectAwards(stats: Map<string, PlayerStats>): Award[] {
  const all = Array.from(stats.values());
  // Each candidate gets a score based on how impressive the achievement is.
  // Higher score = more likely to be selected. This replaces the old fixed-
  // priority system so rare/impressive feats naturally surface over common ones.
  const candidates: { award: Award; score: number; playerId: string }[] = [];
  const add = (id: AwardId, s: PlayerStats, score: number, params: Record<string, number> = {}) => {
    candidates.push({ playerId: s.playerId, score, award: { id, glyph: AWARD_GLYPH[id], playerId: s.playerId, params } });
  };

  // Pants on Fire: most times caught bluffing (>=1)
  const mostCaught = all.filter(s => s.timesCaughtBluffing >= 1)
    .sort((a, b) => b.timesCaughtBluffing - a.timesCaughtBluffing)[0];
  if (mostCaught) {
    // 1→3, 2→7, 3→11
    add('pantsOnFire', mostCaught, mostCaught.timesCaughtBluffing * 4 - 1, { count: mostCaught.timesCaughtBluffing });
  }

  // Honest Abe: most times proven honest, 0 caught bluffing (>=1 proven)
  const honestCandidates = all.filter(s => s.timesProvenHonest >= 1 && s.timesCaughtBluffing === 0)
    .sort((a, b) => b.timesProvenHonest - a.timesProvenHonest);
  if (honestCandidates.length > 0) {
    const h = honestCandidates[0];
    add('honestAbe', h, h.timesProvenHonest * 3, { count: h.timesProvenHonest }); // 1→3, 2→6, 3→9
  }

  // The Inquisitor: most challenges made (>=2)
  const mostChallenges = all.filter(s => s.challengesMade >= 2)
    .sort((a, b) => b.challengesMade - a.challengesMade)[0];
  if (mostChallenges) {
    // 2→5, 3→7.5, 4→10
    add('inquisitor', mostChallenges, mostChallenges.challengesMade * 2.5, { count: mostChallenges.challengesMade });
  }

  // Eagle Eye: best challenge accuracy (>=2 challenges, >=50% win rate)
  const eagleEyeCandidates = all.filter(s => s.challengesMade >= 2)
    .map(s => ({ ...s, winRate: s.challengesWon / s.challengesMade }))
    .filter(s => s.winRate >= 0.5)
    .sort((a, b) => b.winRate - a.winRate || b.challengesWon - a.challengesWon);
  if (eagleEyeCandidates.length > 0) {
    const e = eagleEyeCandidates[0];
    // 2/2→11, 2/3→7.3, 3/4→13.5
    add('eagleEye', e, e.challengesWon * 4 + (e.winRate - 0.5) * 6, { won: e.challengesWon, made: e.challengesMade });
  }

  // The Wall: most blocks made (>=2)
  const mostBlocks = all.filter(s => s.blocksMade >= 2)
    .sort((a, b) => b.blocksMade - a.blocksMade)[0];
  if (mostBlocks) {
    add('wall', mostBlocks, mostBlocks.blocksMade * 3.5, { count: mostBlocks.blocksMade }); // 2→7, 3→10.5, 4→14
  }

  // Smooth Operator: most claims with 0 times caught (>=4 claims)
  const smoothCandidates = all.filter(s => s.actionsClaimed >= 4 && s.timesCaughtBluffing === 0)
    .sort((a, b) => b.actionsClaimed - a.actionsClaimed);
  if (smoothCandidates.length > 0) {
    const sm = smoothCandidates[0];
    add('smoothOperator', sm, sm.actionsClaimed * 1.5, { count: sm.actionsClaimed }); // 4→6, 6→9, 8→12
  }

  // Coup Machine: most coups (>=2)
  const mostCoups = all.filter(s => s.coupsMade >= 2)
    .sort((a, b) => b.coupsMade - a.coupsMade)[0];
  if (mostCoups) {
    add('coupMachine', mostCoups, mostCoups.coupsMade * 4, { count: mostCoups.coupsMade }); // 2→8, 3→12
  }

  // Silent Assassin: most assassinations (>=1)
  const mostAssassinations = all.filter(s => s.assassinationsMade >= 1)
    .sort((a, b) => b.assassinationsMade - a.assassinationsMade)[0];
  if (mostAssassinations) {
    // 1→7, 2→14, 3→21
    add('silentAssassin', mostAssassinations, mostAssassinations.assassinationsMade * 7, { count: mostAssassinations.assassinationsMade });
  }

  // Bold Strategy: most challenges lost (>=2)
  const mostLost = all.filter(s => s.challengesLost >= 2)
    .sort((a, b) => b.challengesLost - a.challengesLost)[0];
  if (mostLost) {
    add('boldStrategy', mostLost, mostLost.challengesLost * 3.5, { count: mostLost.challengesLost }); // 2→7, 3→10.5
  }

  // Quick Exit: first player eliminated
  const firstOut = all.find(s => s.eliminationOrder === 1);
  if (firstOut) {
    add('quickExit', firstOut, 2); // Low flat score: filler award, only appears when slots remain
  }

  // Select: highest score first, max 1 award per player, max 4 total
  const awarded = new Set<string>();
  const selected: Award[] = [];

  candidates.sort((a, b) => b.score - a.score);

  for (const c of candidates) {
    if (awarded.has(c.playerId)) continue;
    awarded.add(c.playerId);
    selected.push(c.award);
    if (selected.length >= 4) break;
  }

  return selected;
}

export interface BluffSummaryEntry {
  playerId: string;
  totalClaims: number;
  bluffs: number;
  caughtBluffing: number;
  unchallengedBluffs: number;
}

export function computeBluffSummary(gameState: ClientGameState): BluffSummaryEntry[] {
  const playerIds = gameState.players.map(p => p.id);
  const stats = computePlayerStats(gameState.actionLog, playerIds);
  const entries: BluffSummaryEntry[] = [];

  for (const s of stats.values()) {
    // Only include players who made at least one claim (includes block claims)
    const totalClaims = s.actionsClaimed + s.blocksMade;
    if (totalClaims === 0) continue;
    entries.push({
      playerId: s.playerId,
      totalClaims,
      bluffs: s.actualBluffs,
      caughtBluffing: s.timesCaughtBluffing,
      unchallengedBluffs: s.actualBluffs - s.timesCaughtBluffing,
    });
  }

  // Sort by bluff count descending, then by total claims
  entries.sort((a, b) => b.bluffs - a.bluffs || b.totalClaims - a.totalClaims);
  return entries;
}

export function computeAwards(gameState: ClientGameState): Award[] {
  if (gameState.turnNumber < 3) return [];
  const stats = computePlayerStats(gameState.actionLog, gameState.players.map(p => p.id));
  return selectAwards(stats);
}
