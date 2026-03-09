import { LogEntry, ClientGameState } from '@/shared/types';

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
  emoji: string;
  title: string;
  playerName: string;
  description: string;
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
        emoji: '🤥',
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
        emoji: '😇',
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
        emoji: '🔍',
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
        emoji: '🦅',
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
        emoji: '🧱',
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
        emoji: '🎭',
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
        emoji: '⚔️',
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
        emoji: '🗡️',
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
        emoji: '🎲',
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
        emoji: '🚪',
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
