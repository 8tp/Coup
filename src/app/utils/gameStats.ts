import { LogEntry, ClientGameState, LogEventType } from '@/shared/types';
// Type-only: erased at compile time, so this module stays React-free.
import type { AwardGlyphKey } from './logGlyphs';

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

export interface Award {
  /** Key into AWARD_GLYPHS; the render site resolves it to a glyph component. */
  glyph: AwardGlyphKey;
  title: string;
  playerName: string;
  description: string;
}

export type RecapTone = 'gold' | 'green' | 'red' | 'blue' | 'purple' | 'gray';

export interface GameRecapItem {
  label: string;
  value: string;
  detail: string;
  tone: RecapTone;
}

export function computePlayerStats(log: LogEntry[], playerIds: string[], playerNames: Map<string, string>): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();

  for (const id of playerIds) {
    stats.set(id, {
      playerId: id,
      playerName: playerNames.get(id) ?? 'Unknown',
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

  // Pants on Fire — most times caught bluffing (≥1)
  const mostCaught = all.filter(s => s.timesCaughtBluffing >= 1)
    .sort((a, b) => b.timesCaughtBluffing - a.timesCaughtBluffing)[0];
  if (mostCaught) {
    candidates.push({
      playerId: mostCaught.playerId,
      score: mostCaught.timesCaughtBluffing * 4 - 1, // 1→3, 2→7, 3→11
      award: {
        glyph: 'bluff',
        title: 'Pants on Fire',
        playerName: mostCaught.playerName,
        description: `caught bluffing ${mostCaught.timesCaughtBluffing}x`,
      },
    });
  }

  // Honest Abe — most times proven honest, 0 caught bluffing (≥1 proven)
  const honestCandidates = all.filter(s => s.timesProvenHonest >= 1 && s.timesCaughtBluffing === 0)
    .sort((a, b) => b.timesProvenHonest - a.timesProvenHonest);
  if (honestCandidates.length > 0) {
    const h = honestCandidates[0];
    candidates.push({
      playerId: h.playerId,
      score: h.timesProvenHonest * 3, // 1→3, 2→6, 3→9
      award: {
        glyph: 'truth',
        title: 'Honest Abe',
        playerName: h.playerName,
        description: `proven honest ${h.timesProvenHonest}x, never caught`,
      },
    });
  }

  // The Inquisitor — most challenges made (≥2)
  const mostChallenges = all.filter(s => s.challengesMade >= 2)
    .sort((a, b) => b.challengesMade - a.challengesMade)[0];
  if (mostChallenges) {
    candidates.push({
      playerId: mostChallenges.playerId,
      score: mostChallenges.challengesMade * 2.5, // 2→5, 3→7.5, 4→10
      award: {
        glyph: 'challenge',
        title: 'The Inquisitor',
        playerName: mostChallenges.playerName,
        description: `${mostChallenges.challengesMade} challenges made`,
      },
    });
  }

  // Eagle Eye — best challenge accuracy (≥2 challenges, ≥50% win rate)
  const eagleEyeCandidates = all.filter(s => s.challengesMade >= 2)
    .map(s => ({ ...s, winRate: s.challengesWon / s.challengesMade }))
    .filter(s => s.winRate >= 0.5)
    .sort((a, b) => b.winRate - a.winRate || b.challengesWon - a.challengesWon);
  if (eagleEyeCandidates.length > 0) {
    const e = eagleEyeCandidates[0];
    candidates.push({
      playerId: e.playerId,
      score: e.challengesWon * 4 + (e.winRate - 0.5) * 6, // 2/2→11, 2/3→7.3, 3/4→13.5
      award: {
        glyph: 'target',
        title: 'Eagle Eye',
        playerName: e.playerName,
        description: `${e.challengesWon}/${e.challengesMade} challenges correct`,
      },
    });
  }

  // The Wall — most blocks made (≥2)
  const mostBlocks = all.filter(s => s.blocksMade >= 2)
    .sort((a, b) => b.blocksMade - a.blocksMade)[0];
  if (mostBlocks) {
    candidates.push({
      playerId: mostBlocks.playerId,
      score: mostBlocks.blocksMade * 3.5, // 2→7, 3→10.5, 4→14
      award: {
        glyph: 'block',
        title: 'The Wall',
        playerName: mostBlocks.playerName,
        description: `${mostBlocks.blocksMade} blocks made`,
      },
    });
  }

  // Smooth Operator — most claims with 0 times caught (≥4 claims)
  const smoothCandidates = all.filter(s => s.actionsClaimed >= 4 && s.timesCaughtBluffing === 0)
    .sort((a, b) => b.actionsClaimed - a.actionsClaimed);
  if (smoothCandidates.length > 0) {
    const sm = smoothCandidates[0];
    candidates.push({
      playerId: sm.playerId,
      score: sm.actionsClaimed * 1.5, // 4→6, 6→9, 8→12
      award: {
        glyph: 'claim',
        title: 'Smooth Operator',
        playerName: sm.playerName,
        description: `${sm.actionsClaimed} claims, never caught`,
      },
    });
  }

  // Coup Machine — most coups (≥2)
  const mostCoups = all.filter(s => s.coupsMade >= 2)
    .sort((a, b) => b.coupsMade - a.coupsMade)[0];
  if (mostCoups) {
    candidates.push({
      playerId: mostCoups.playerId,
      score: mostCoups.coupsMade * 4, // 2→8, 3→12
      award: {
        glyph: 'coup',
        title: 'Coup Machine',
        playerName: mostCoups.playerName,
        description: `${mostCoups.coupsMade} coups launched`,
      },
    });
  }

  // Silent Assassin — most assassinations (≥1)
  const mostAssassinations = all.filter(s => s.assassinationsMade >= 1)
    .sort((a, b) => b.assassinationsMade - a.assassinationsMade)[0];
  if (mostAssassinations) {
    candidates.push({
      playerId: mostAssassinations.playerId,
      score: mostAssassinations.assassinationsMade * 7, // 1→7, 2→14, 3→21
      award: {
        glyph: 'assassinate',
        title: 'Silent Assassin',
        playerName: mostAssassinations.playerName,
        description: mostAssassinations.assassinationsMade === 1
          ? '1 assassination'
          : `${mostAssassinations.assassinationsMade} assassinations`,
      },
    });
  }

  // Bold Strategy — most challenges lost (≥2)
  const mostLost = all.filter(s => s.challengesLost >= 2)
    .sort((a, b) => b.challengesLost - a.challengesLost)[0];
  if (mostLost) {
    candidates.push({
      playerId: mostLost.playerId,
      score: mostLost.challengesLost * 3.5, // 2→7, 3→10.5
      award: {
        glyph: 'dice',
        title: 'Bold Strategy',
        playerName: mostLost.playerName,
        description: `${mostLost.challengesLost} challenges backfired`,
      },
    });
  }

  // Quick Exit — first player eliminated
  const firstOut = all.find(s => s.eliminationOrder === 1);
  if (firstOut) {
    candidates.push({
      playerId: firstOut.playerId,
      score: 2, // Low flat score — filler award, only appears when slots remain
      award: {
        glyph: 'exit',
        title: 'Quick Exit',
        playerName: firstOut.playerName,
        description: 'first player eliminated',
      },
    });
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

function buildFlavorStats(gameState: ClientGameState) {
  const playerIds = gameState.players.map(p => p.id);
  const playerNames = new Map<string, string>();
  for (const p of gameState.players) {
    playerNames.set(p.id, p.name);
  }
  return computePlayerStats(gameState.actionLog, playerIds, playerNames);
}

export function getWinnerFlavorText(gameState: ClientGameState): string {
  const winnerId = gameState.winnerId;
  if (!winnerId) return 'Your bluffs were legendary.';

  const w = buildFlavorStats(gameState).get(winnerId);
  if (!w) return 'Your bluffs were legendary.';

  // Pure Income + Coup — no character claims at all
  if (w.actionsClaimed === 0) {
    return 'Sometimes honesty is the best strategy.';
  }

  // Caught bluffing multiple times but still won
  if (w.timesCaughtBluffing >= 2) {
    return 'Caught bluffing and still standing. Impressive.';
  }

  // Caught bluffing once but still won
  if (w.timesCaughtBluffing === 1) {
    return "Caught red-handed, and it didn't even matter.";
  }

  // Great at reading opponents
  if (w.challengesWon >= 2) {
    return 'You read them like an open book.';
  }

  // Proven honest multiple times — truth as a weapon
  if (w.timesProvenHonest >= 2) {
    return 'The truth was your greatest weapon.';
  }

  // Assassination-heavy victory
  if (w.assassinationsMade >= 2) {
    return "The Assassin's blade served you well.";
  }

  // Coup-heavy victory
  if (w.coupsMade >= 2) {
    return 'Brute force gets the job done.';
  }

  // Block-heavy — defensive fortress
  if (w.blocksMade >= 2) {
    return 'An impenetrable defense.';
  }

  // Many claims, never caught — unquestioned authority
  if (w.actionsClaimed >= 3 && w.timesCaughtBluffing === 0) {
    return 'Nobody dared question you.';
  }

  // Quick victory
  if (gameState.turnNumber <= 6) {
    return 'Swift and decisive.';
  }

  return 'Your bluffs were legendary.';
}

export function getLoserFlavorText(gameState: ClientGameState): string {
  const myId = gameState.myId;
  if (!myId) return 'Better luck next time.';

  const stats = buildFlavorStats(gameState);
  const m = stats.get(myId);
  if (!m) return 'Better luck next time.';

  // First player eliminated
  if (m.eliminationOrder === 1) {
    return 'First out. It happens to the best of us.';
  }

  // Caught bluffing multiple times
  if (m.timesCaughtBluffing >= 2) {
    return 'Your poker face needs some work.';
  }

  // Caught bluffing once — the fatal bluff
  if (m.timesCaughtBluffing === 1) {
    return 'That one bluff cost you everything.';
  }

  // Bad reads — lost multiple challenges
  if (m.challengesLost >= 2) {
    return 'Your reads were a bit off.';
  }

  // Played it safe with no claims
  if (m.actionsClaimed === 0) {
    return "Playing it safe wasn't safe enough.";
  }

  // Good challenges but still lost
  if (m.challengesWon >= 2) {
    return 'Great reads, but it wasn\'t enough.';
  }

  // Strong defense but still fell
  if (m.blocksMade >= 2) {
    return 'You held them off as long as you could.';
  }

  // Put up a fight with assassinations or coups
  if (m.assassinationsMade >= 1 || m.coupsMade >= 1) {
    return 'You fought hard, but fell short.';
  }

  // Quick game
  if (gameState.turnNumber <= 6) {
    return 'It was over before it started.';
  }

  return 'Better luck next time.';
}

export interface BluffSummaryEntry {
  playerId: string;
  playerName: string;
  totalClaims: number;
  bluffs: number;
  caughtBluffing: number;
  unchallengedBluffs: number;
}

export function computeBluffSummary(gameState: ClientGameState): BluffSummaryEntry[] {
  const playerIds = gameState.players.map(p => p.id);
  const playerNames = new Map<string, string>();
  for (const p of gameState.players) {
    playerNames.set(p.id, p.id === gameState.myId ? 'You' : p.name);
  }

  const stats = computePlayerStats(gameState.actionLog, playerIds, playerNames);
  const entries: BluffSummaryEntry[] = [];

  for (const s of stats.values()) {
    // Only include players who made at least one claim (includes block claims)
    const totalClaims = s.actionsClaimed + s.blocksMade;
    if (totalClaims === 0) continue;
    entries.push({
      playerId: s.playerId,
      playerName: s.playerName,
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

const DECISIVE_EVENT_TYPES = new Set<LogEventType>([
  'coup',
  'assassination',
  'challenge_success',
  'challenge_fail',
  'block_challenge_success',
  'block_challenge_fail',
  'influence_loss',
  'elimination',
  'embezzle',
  'examine_decision',
  'action_resolve',
  'convert',
]);

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function displayName(gameState: ClientGameState, playerId: string | null | undefined, fallback = 'Unknown'): string {
  if (!playerId) return fallback;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return fallback;
  return player.id === gameState.myId ? 'You' : player.name;
}

function decisiveTitle(entry: LogEntry, gameState: ClientGameState): string {
  const actor = displayName(gameState, entry.actorId, entry.actorName ?? 'Someone');
  const target = displayName(gameState, entry.targetId, 'the table');

  switch (entry.eventType) {
    case 'elimination':
      return `${actor} was eliminated`;
    case 'coup':
      return `${actor} launched a Coup`;
    case 'assassination':
      return `${actor} landed an assassination`;
    case 'challenge_success':
      return `${actor} caught a bluff`;
    case 'challenge_fail':
      return `${actor} proved the claim`;
    case 'block_challenge_success':
      return `${actor} broke a block`;
    case 'block_challenge_fail':
      return `${actor} proved the block`;
    case 'influence_loss':
      return `${actor} lost influence`;
    case 'embezzle':
      return `${actor} took the reserve`;
    case 'convert':
      return `${actor} shifted factions`;
    case 'examine_decision':
      return `${actor} resolved an examine`;
    case 'action_resolve':
      if (entry.character) return `${actor} resolved ${entry.character}`;
      if (entry.targetId) return `${actor} moved against ${target}`;
      return `${actor} resolved an action`;
    default:
      return entry.actorName ?? 'Final move';
  }
}

interface CoinMove {
  amount: number;
  playerName: string;
  verb: string;
  entry: LogEntry;
}

function embezzleAmount(log: LogEntry[], index: number, actorId: string | null): number {
  for (let i = index - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry.actorId !== actorId) continue;
    const match = entry.message.match(/Treasury Reserve \((\d+) coins?\)/);
    if (match) return Number(match[1]);
  }
  return 0;
}

function coinMoveForEntry(log: LogEntry[], index: number, gameState: ClientGameState): CoinMove | null {
  const entry = log[index];
  const playerName = displayName(gameState, entry.actorId, entry.actorName ?? 'Someone');

  if (entry.eventType === 'income') {
    return { amount: 1, playerName, verb: 'gained', entry };
  }

  if (entry.eventType === 'coup') {
    return { amount: 7, playerName, verb: 'spent', entry };
  }

  if (entry.eventType === 'convert') {
    const amount = Number(entry.message.match(/\((\d+) coins? to Treasury Reserve\)/)?.[1] ?? 0);
    return amount > 0 ? { amount, playerName, verb: 'paid', entry } : null;
  }

  if (entry.eventType === 'embezzle') {
    const amount = embezzleAmount(log, index, entry.actorId);
    return amount > 0 ? { amount, playerName, verb: 'took', entry } : null;
  }

  if (entry.eventType !== 'action_resolve') return null;

  const plusAmount = Number(entry.message.match(/\(\+(\d+) coins?\)/)?.[1] ?? 0);
  if (plusAmount > 0) {
    return { amount: plusAmount, playerName, verb: 'gained', entry };
  }

  const stealAmount = Number(entry.message.match(/steals (\d+) coin/)?.[1] ?? 0);
  if (stealAmount > 0) {
    return { amount: stealAmount, playerName, verb: 'stole', entry };
  }

  return null;
}

function biggestCoinMove(gameState: ClientGameState): CoinMove | null {
  let biggest: CoinMove | null = null;

  for (let i = 0; i < gameState.actionLog.length; i++) {
    const move = coinMoveForEntry(gameState.actionLog, i, gameState);
    if (!move) continue;
    if (!biggest || move.amount > biggest.amount) {
      biggest = move;
    }
  }

  return biggest;
}

export function computeGameRecap(gameState: ClientGameState): GameRecapItem[] {
  const items: GameRecapItem[] = [];
  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  const playerIds = gameState.players.map(p => p.id);
  const playerNames = new Map<string, string>();

  for (const p of gameState.players) {
    playerNames.set(p.id, p.id === gameState.myId ? 'You' : p.name);
  }

  const stats = computePlayerStats(gameState.actionLog, playerIds, playerNames);

  if (winner) {
    const influenceLeft = winner.influences.filter(influence => !influence.revealed).length;
    items.push({
      label: 'Winner standing',
      value: `${displayName(gameState, winner.id)} kept ${plural(influenceLeft, 'influence')}`,
      detail: `${winner.coins} coin${winner.coins === 1 ? '' : 's'} left after ${plural(gameState.turnNumber, 'turn')}.`,
      tone: 'gold',
    });
  }

  const decisiveEntry = [...gameState.actionLog]
    .reverse()
    .find(entry => DECISIVE_EVENT_TYPES.has(entry.eventType));
  if (decisiveEntry) {
    items.push({
      label: 'Deciding moment',
      value: decisiveTitle(decisiveEntry, gameState),
      detail: decisiveEntry.message,
      tone: 'purple',
    });
  }

  const coinMove = biggestCoinMove(gameState);
  if (coinMove) {
    items.push({
      label: 'Biggest coin move',
      value: `${coinMove.playerName} ${coinMove.verb} ${plural(coinMove.amount, 'coin')}`,
      detail: coinMove.entry.message,
      tone: coinMove.verb === 'spent' || coinMove.verb === 'paid' ? 'red' : 'green',
    });
  }

  const allStats = Array.from(stats.values());
  const totalClaims = allStats.reduce((sum, s) => sum + s.actionsClaimed + s.blocksMade, 0);
  const totalBluffs = allStats.reduce((sum, s) => sum + s.actualBluffs, 0);
  const totalCaught = allStats.reduce((sum, s) => sum + s.timesCaughtBluffing, 0);
  const biggestBluffer = allStats
    .filter(s => s.actualBluffs > 0)
    .sort((a, b) => b.actualBluffs - a.actualBluffs || b.actionsClaimed + b.blocksMade - (a.actionsClaimed + a.blocksMade))[0];

  if (totalClaims > 0) {
    items.push({
      label: 'Bluff table',
      value: totalBluffs > 0
        ? `${totalBluffs}/${totalClaims} claims were bluffs`
        : 'Every logged claim was honest',
      detail: biggestBluffer
        ? `${biggestBluffer.playerName} led with ${plural(biggestBluffer.actualBluffs, 'bluff')}; ${plural(totalCaught, 'bluff')} caught.`
        : 'No one was marked as bluffing by the final truth reveal.',
      tone: totalBluffs > 0 ? 'red' : 'green',
    });
  }

  const totalChallenges = allStats.reduce((sum, s) => sum + s.challengesMade, 0);
  const totalChallengeWins = allStats.reduce((sum, s) => sum + s.challengesWon, 0);
  const bestReader = allStats
    .filter(s => s.challengesWon > 0)
    .sort((a, b) => b.challengesWon - a.challengesWon || a.challengesLost - b.challengesLost)[0];

  if (totalChallenges > 0) {
    items.push({
      label: 'Challenge reads',
      value: `${totalChallengeWins}/${totalChallenges} challenges hit`,
      detail: bestReader
        ? `${bestReader.playerName} had the sharpest read with ${plural(bestReader.challengesWon, 'correct challenge')}.`
        : 'Every challenge at the table missed.',
      tone: totalChallengeWins > 0 ? 'blue' : 'gray',
    });
  }

  return items;
}

export function computeAwards(gameState: ClientGameState): Award[] {
  if (gameState.turnNumber < 3) return [];

  const playerIds = gameState.players.map(p => p.id);
  const playerNames = new Map<string, string>();
  for (const p of gameState.players) {
    playerNames.set(p.id, p.id === gameState.myId ? 'You' : p.name);
  }

  const stats = computePlayerStats(gameState.actionLog, playerIds, playerNames);
  return selectAwards(stats);
}
