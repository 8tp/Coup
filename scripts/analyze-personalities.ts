/**
 * Treason Personality Analysis Script
 *
 * Analyzes the Treason games.json database to extract player behavioral profiles,
 * clusters them into 5 personality archetypes using K-means, and outputs
 * calibrated PersonalityParams values.
 *
 * Usage: npx tsx scripts/analyze-personalities.ts [path-to-games.json]
 *
 * Data fields: players (count), humanPlayers, gameType, playerRank, playerDisconnect, events (base64)
 */

import fs from 'fs';
import path from 'path';

// ─── Binary Encoding Constants (reused from analyze-treason.ts) ───

const TYPE_START_OF_TURN = 1;
const TYPE_CHALLENGE_SUCCESS = 3;
const TYPE_CHALLENGE_FAIL = 4;
const TYPE_BLOCK = 5;
const TYPE_PLAYER_LEFT = 6;
const TYPE_GAME_OVER = 7;

const ROLES = ['none', 'duke', 'captain', 'assassin', 'ambassador', 'contessa'];

const ACTION_MAP: Record<number, { action: string; targeted: boolean }> = {
  0x1: { action: 'tax', targeted: false },
  0x9: { action: 'foreign-aid', targeted: false },
  0x2: { action: 'steal', targeted: true },
  0x3: { action: 'assassinate', targeted: true },
  0x4: { action: 'exchange', targeted: false },
  0xC: { action: 'interrogate', targeted: true },
  0x5: { action: 'coup', targeted: true },
  0xD: { action: 'income', targeted: false },
  0x6: { action: 'change-team', targeted: false },
  0x7: { action: 'convert', targeted: true },
  0xE: { action: 'embezzle', targeted: false },
};

// ─── Event Types ───

interface PlayerState {
  cash: number;
  influence: string[];
}

interface StartOfTurnEvent {
  type: 'start_of_turn';
  whoseTurn: number;
  playerStates: PlayerState[];
}

interface ActionEvent {
  type: 'action';
  action: string;
  player: number;
  target?: number;
}

interface ChallengeEvent {
  type: 'challenge_success' | 'challenge_fail';
  challenger: number;
  challenged: number;
}

interface BlockEvent {
  type: 'block';
  blockingPlayer: number;
  blockingRole: string;
}

interface PlayerLeftEvent {
  type: 'player_left';
  player: number;
}

interface GameOverEvent {
  type: 'game_over';
  playerStates: PlayerState[];
}

type GameEvent = StartOfTurnEvent | ActionEvent | ChallengeEvent | BlockEvent | PlayerLeftEvent | GameOverEvent;

// ─── Decode Functions ───

function decodeInfluence(nibble: number): string {
  const revealed = (nibble & 0x8) !== 0;
  const roleCode = nibble & 0x7;
  const role = ROLES[roleCode] || 'none';
  if (role === 'none') return '';
  return revealed ? `!${role}` : role;
}

function unpackEvents(base64: string, playerCount: number): GameEvent[] {
  const buf = Buffer.from(base64, 'base64');
  const events: GameEvent[] = [];
  let i = 0;
  let lastTurnPlayer = 0;
  let expectAction = false;

  while (i < buf.length) {
    if (expectAction) {
      const byte = buf[i++];
      const actionCode = (byte >> 4) & 0xF;
      const target = byte & 0xF;
      const actionDef = ACTION_MAP[actionCode];
      if (actionDef) {
        const evt: ActionEvent = { type: 'action', action: actionDef.action, player: lastTurnPlayer };
        if (actionDef.targeted && target > 0) evt.target = target;
        events.push(evt);
      }
      expectAction = false;
      continue;
    }

    const byte = buf[i++];
    const eventType = (byte >> 4) & 0xF;
    const lowNibble = byte & 0xF;

    switch (eventType) {
      case TYPE_START_OF_TURN: {
        const whoseTurn = lowNibble;
        lastTurnPlayer = whoseTurn;
        const playerStates: PlayerState[] = [];
        for (let p = 0; p < playerCount && i + 1 < buf.length; p++) {
          const cash = buf[i++];
          const infByte = buf[i++];
          const inf0 = decodeInfluence((infByte >> 4) & 0xF);
          const inf1 = decodeInfluence(infByte & 0xF);
          playerStates.push({ cash, influence: [inf0, inf1].filter(x => x !== '') });
        }
        events.push({ type: 'start_of_turn', whoseTurn, playerStates });
        expectAction = true;
        break;
      }
      case TYPE_GAME_OVER: {
        const playerStates: PlayerState[] = [];
        for (let p = 0; p < playerCount && i + 1 < buf.length; p++) {
          const cash = buf[i++];
          const infByte = buf[i++];
          const inf0 = decodeInfluence((infByte >> 4) & 0xF);
          const inf1 = decodeInfluence(infByte & 0xF);
          playerStates.push({ cash, influence: [inf0, inf1].filter(x => x !== '') });
        }
        events.push({ type: 'game_over', playerStates });
        break;
      }
      case TYPE_CHALLENGE_SUCCESS:
        events.push({ type: 'challenge_success', challenger: lowNibble, challenged: buf[i++] & 0xF });
        break;
      case TYPE_CHALLENGE_FAIL:
        events.push({ type: 'challenge_fail', challenger: lowNibble, challenged: buf[i++] & 0xF });
        break;
      case TYPE_BLOCK:
        events.push({ type: 'block', blockingPlayer: lowNibble, blockingRole: ROLES[buf[i++]] || 'unknown' });
        break;
      case TYPE_PLAYER_LEFT:
        events.push({ type: 'player_left', player: lowNibble });
        break;
    }
  }

  return events;
}

// ─── Behavioral Profile Vector ───

interface BehaviorProfile {
  // Action bluff rates (0-1)
  taxBluff: number;
  stealBluff: number;
  assassinateBluff: number;
  exchangeBluff: number;
  // Block bluff rates
  contessaBlockBluff: number;
  otherBlockBluff: number;
  // Challenge rate
  challengeRate: number;
  challengeSuccessRate: number;
  // Action preferences
  safeActionFraction: number; // Income + ForeignAid as fraction of total actions
  aggressionIndex: number;   // (Steal + Assassinate + Coup) / total actions
  // Targeting
  targetLeaderRate: number;  // fraction of targeted actions aimed at coin leader
  // Revenge (retaliation rate)
  revengeRate: number;       // fraction of targeted actions aimed at last attacker
}

const PROFILE_DIMS = 12;

// ─── Extract Profile from Game Events ───

function extractProfile(
  events: GameEvent[],
  playerIndex: number,
  playerCount: number,
): BehaviorProfile | null {
  // Get player's hidden cards at each turn from start_of_turn events
  const playerCards: Map<number, string[]> = new Map(); // turnIndex -> hidden cards
  let turnCount = 0;

  // Action counts
  let taxTotal = 0, taxBluff = 0;
  let stealTotal = 0, stealBluff = 0;
  let assassinateTotal = 0, assassinateBluff = 0;
  let exchangeTotal = 0, exchangeBluff = 0;
  let incomeCount = 0, foreignAidCount = 0, coupCount = 0;

  // Block counts
  let contessaBlockTotal = 0, contessaBlockBluff = 0;
  let otherBlockTotal = 0, otherBlockBluff = 0;

  // Challenge counts
  let challengeOpportunities = 0, challengesMade = 0, challengeSuccesses = 0;

  // Targeting
  let targetedActions = 0, targetLeader = 0;
  let attackedBy: number | null = null;
  let retaliations = 0, retaliationOpps = 0;

  const CLAIM_ROLES: Record<string, string> = {
    'tax': 'duke', 'steal': 'captain', 'assassinate': 'assassin', 'exchange': 'ambassador',
  };

  const BLOCK_ROLES: Record<string, string[]> = {
    'contessa': ['assassinate'],
    'duke': ['foreign-aid'],
    'captain': ['steal'],
    'ambassador': ['steal'],
  };

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    if (ev.type === 'start_of_turn') {
      if (ev.playerStates[playerIndex - 1]) {
        const ps = ev.playerStates[playerIndex - 1];
        const hidden = ps.influence.filter(inf => !inf.startsWith('!'));
        playerCards.set(turnCount, hidden);
      }
      turnCount++;
    }

    if (ev.type === 'action' && ev.player === playerIndex) {
      const claimed = CLAIM_ROLES[ev.action];
      const hidden = playerCards.get(turnCount - 1) || [];

      if (ev.action === 'tax') {
        taxTotal++;
        if (claimed && !hidden.includes(claimed)) taxBluff++;
      } else if (ev.action === 'steal') {
        stealTotal++;
        if (claimed && !hidden.includes(claimed)) stealBluff++;
      } else if (ev.action === 'assassinate') {
        assassinateTotal++;
        if (claimed && !hidden.includes(claimed)) assassinateBluff++;
      } else if (ev.action === 'exchange') {
        exchangeTotal++;
        if (claimed && !hidden.includes(claimed)) exchangeBluff++;
      } else if (ev.action === 'income') {
        incomeCount++;
      } else if (ev.action === 'foreign-aid') {
        foreignAidCount++;
      } else if (ev.action === 'coup') {
        coupCount++;
      }

      // Targeting analysis
      if (ev.target && ev.target !== playerIndex) {
        targetedActions++;

        // Check if target is the coin leader
        const lastTurn = playerCards.get(turnCount - 1);
        if (lastTurn) {
          const prevSot = events.findLast((e, idx) =>
            idx < i && e.type === 'start_of_turn') as StartOfTurnEvent | undefined;
          if (prevSot) {
            const maxCoins = Math.max(...prevSot.playerStates
              .filter((_, idx) => idx !== playerIndex - 1)
              .map(ps => ps.cash));
            if (prevSot.playerStates[ev.target - 1]?.cash === maxCoins) targetLeader++;
          }
        }

        // Revenge tracking
        if (attackedBy !== null) {
          retaliationOpps++;
          if (ev.target === attackedBy) retaliations++;
        }
      }
    }

    // Track who attacked this player
    if (ev.type === 'action' && ev.target === playerIndex && ev.player !== playerIndex) {
      attackedBy = ev.player;
    }

    // Block tracking
    if (ev.type === 'block' && ev.blockingPlayer === playerIndex) {
      const hidden = playerCards.get(turnCount - 1) || [];
      const role = ev.blockingRole;

      if (role === 'contessa') {
        contessaBlockTotal++;
        if (!hidden.includes('contessa')) contessaBlockBluff++;
      } else {
        otherBlockTotal++;
        if (!hidden.includes(role)) otherBlockBluff++;
      }
    }

    // Challenge tracking (when this player could have challenged but didn't, or did)
    if (ev.type === 'action' && ev.player !== playerIndex) {
      const claimed = CLAIM_ROLES[ev.action];
      if (claimed) challengeOpportunities++;
    }

    if ((ev.type === 'challenge_success' || ev.type === 'challenge_fail') &&
        ev.challenger === playerIndex) {
      challengesMade++;
      if (ev.type === 'challenge_success') challengeSuccesses++;
    }
  }

  const totalActions = taxTotal + stealTotal + assassinateTotal + exchangeTotal +
    incomeCount + foreignAidCount + coupCount;

  if (totalActions < 3) return null; // Not enough data

  return {
    taxBluff: taxTotal > 0 ? taxBluff / taxTotal : 0,
    stealBluff: stealTotal > 0 ? stealBluff / stealTotal : 0,
    assassinateBluff: assassinateTotal > 0 ? assassinateBluff / assassinateTotal : 0,
    exchangeBluff: exchangeTotal > 0 ? exchangeBluff / exchangeTotal : 0,
    contessaBlockBluff: contessaBlockTotal > 0 ? contessaBlockBluff / contessaBlockTotal : 0,
    otherBlockBluff: otherBlockTotal > 0 ? otherBlockBluff / otherBlockTotal : 0,
    challengeRate: challengeOpportunities > 0 ? challengesMade / challengeOpportunities : 0,
    challengeSuccessRate: challengesMade > 0 ? challengeSuccesses / challengesMade : 0,
    safeActionFraction: (incomeCount + foreignAidCount) / totalActions,
    aggressionIndex: (stealTotal + assassinateTotal + coupCount) / totalActions,
    targetLeaderRate: targetedActions > 0 ? targetLeader / targetedActions : 0.5,
    revengeRate: retaliationOpps > 0 ? retaliations / retaliationOpps : 0,
  };
}

// ─── K-Means Clustering (from scratch, no external deps) ───

function profileToVector(p: BehaviorProfile): number[] {
  return [
    p.taxBluff, p.stealBluff, p.assassinateBluff, p.exchangeBluff,
    p.contessaBlockBluff, p.otherBlockBluff,
    p.challengeRate, p.challengeSuccessRate,
    p.safeActionFraction, p.aggressionIndex,
    p.targetLeaderRate, p.revengeRate,
  ];
}

function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

function kMeans(data: number[][], k: number, maxIter = 50): { centroids: number[][]; assignments: number[] } {
  const n = data.length;
  const dims = data[0].length;

  // Initialize centroids with k-means++ seeding
  const centroids: number[][] = [];
  centroids.push([...data[Math.floor(Math.random() * n)]]);

  for (let c = 1; c < k; c++) {
    const dists = data.map(point => {
      let minDist = Infinity;
      for (const cent of centroids) {
        const d = distance(point, cent);
        if (d < minDist) minDist = d;
      }
      return minDist;
    });
    const totalDist = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalDist;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) {
        centroids.push([...data[i]]);
        break;
      }
    }
    if (centroids.length <= c) centroids.push([...data[Math.floor(Math.random() * n)]]);
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each point to nearest centroid
    const newAssignments = data.map(point => {
      let minDist = Infinity;
      let bestC = 0;
      for (let c = 0; c < k; c++) {
        const d = distance(point, centroids[c]);
        if (d < minDist) {
          minDist = d;
          bestC = c;
        }
      }
      return bestC;
    });

    // Check convergence
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (newAssignments[i] !== assignments[i]) { changed = true; break; }
    }
    assignments = newAssignments;
    if (!changed) break;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = data.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;
      for (let d = 0; d < dims; d++) {
        centroids[c][d] = members.reduce((sum, m) => sum + m[d], 0) / members.length;
      }
    }
  }

  return { centroids, assignments };
}

// ─── Map Clusters to Archetype Names ───

const ARCHETYPE_NAMES = ['aggressive', 'conservative', 'vengeful', 'deceptive', 'analytical'] as const;

function mapClustersToArchetypes(centroids: number[][]): string[] {
  const names: string[] = new Array(centroids.length).fill('');
  const used = new Set<string>();

  // Score each cluster against each archetype
  const scores: Array<{ cluster: number; archetype: string; score: number }> = [];

  for (let c = 0; c < centroids.length; c++) {
    const v = centroids[c];

    // Aggressive: high aggression index, high bluff rates, high challenge rate
    scores.push({ cluster: c, archetype: 'aggressive',
      score: v[9] * 3 + (v[0] + v[1] + v[2]) + v[6] * 2 - v[8] * 2 });

    // Conservative: high safe action fraction, low bluff rates
    scores.push({ cluster: c, archetype: 'conservative',
      score: v[8] * 4 - (v[0] + v[1] + v[2] + v[3]) * 2 - v[6] * 2 });

    // Vengeful: high revenge rate, moderate bluff rates
    scores.push({ cluster: c, archetype: 'vengeful',
      score: v[11] * 5 + v[9] * 1 - v[8] * 1 });

    // Deceptive: highest bluff rates, low challenge rate
    scores.push({ cluster: c, archetype: 'deceptive',
      score: (v[0] + v[1] + v[2] + v[3] + v[4] + v[5]) * 2 - v[6] * 3 });

    // Analytical: high challenge success rate, moderate bluff, high leader targeting
    scores.push({ cluster: c, archetype: 'analytical',
      score: v[7] * 4 + v[10] * 2 + v[6] * 2 - (v[0] + v[1] + v[2]) * 1 });
  }

  // Greedy assignment: highest score first
  scores.sort((a, b) => b.score - a.score);
  for (const s of scores) {
    if (names[s.cluster] !== '' || used.has(s.archetype)) continue;
    names[s.cluster] = s.archetype;
    used.add(s.archetype);
  }

  // Fill any remaining
  for (let c = 0; c < centroids.length; c++) {
    if (names[c] === '') {
      for (const name of ARCHETYPE_NAMES) {
        if (!used.has(name)) {
          names[c] = name;
          used.add(name);
          break;
        }
      }
    }
  }

  return names;
}

// ─── Convert Centroid to PersonalityParams ───

function centroidToParams(centroid: number[], name: string): Record<string, number | string> {
  // Map the 12-dim centroid to our 18 personality parameters
  const [
    taxBluff, stealBluff, assassinateBluff, exchangeBluff,
    contessaBlockBluff, otherBlockBluff,
    challengeRate, challengeSuccessRate,
    safeActionFraction, aggressionIndex,
    targetLeaderRate, revengeRate,
  ] = centroid;

  return {
    name,
    bluffRateTax: round(taxBluff),
    bluffRateSteal: round(stealBluff),
    bluffRateAssassinate: round(assassinateBluff),
    bluffRateExchange: round(exchangeBluff),
    bluffRateContessa: round(contessaBlockBluff),
    bluffRateOtherBlock: round(otherBlockBluff),
    challengeRateBase: round(challengeRate),
    challengeRateWithEvidence: round(Math.min(challengeRate * 2.5, 0.4)),
    challengeRateBlock: round(challengeRate * 1.2),
    actionWeightIncome: round(1.0 + safeActionFraction * 1.5 - 0.5),
    actionWeightForeignAid: round(1.0 + safeActionFraction * 0.8 - 0.3),
    actionWeightSteal: round(0.8 + aggressionIndex * 1.2),
    actionWeightAssassinate: round(0.7 + aggressionIndex * 1.5),
    leaderBias: round(targetLeaderRate),
    revengeWeight: round(revengeRate),
    cardValueSpread: round(0.8 + challengeSuccessRate * 0.6),
    bluffPersistenceModifier: round(0.5 + (taxBluff + stealBluff) * 2),
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

// ─── Main ───

async function main() {
  const filePath = process.argv[2] || path.join(process.env.HOME || '', 'Documents', 'games.json');

  console.log(`\nReading ${filePath}...`);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const allGames: Array<{
    players: number;
    humanPlayers?: number;
    events: string;
    playerRank?: string[];
    playerDisconnect?: string[];
    gameType?: string;
  }> = Array.isArray(raw) ? raw : Object.values(raw);
  console.log(`Total games in database: ${allGames.length.toLocaleString()}`);

  // Filter: 5-player, original Coup, no disconnects, at least 2 humans
  const validGames = allGames.filter(g => {
    if (!g) return false;
    if (g.players !== 5) return false;
    if (g.gameType !== 'original') return false;
    if (g.playerDisconnect && g.playerDisconnect.length > 0) return false;
    if ((g.humanPlayers || 0) < 2) return false; // Skip single-human vs AI games
    return true;
  });
  console.log(`Valid 5P original games (no disconnects, 2+ humans): ${validGames.length.toLocaleString()}`);

  // Extract behavioral profiles (only from human players)
  console.log('\nExtracting behavioral profiles...');
  const profiles: BehaviorProfile[] = [];

  for (const game of validGames) {
    const events = unpackEvents(game.events, game.players);
    for (let p = 1; p <= game.players; p++) {
      // Only extract profiles from human players (not AI)
      if (game.playerRank && game.playerRank[p - 1] === 'ai') continue;
      const profile = extractProfile(events, p, game.players);
      if (profile) profiles.push(profile);
    }
  }
  console.log(`Total player-game profiles: ${profiles.length.toLocaleString()}`);

  // Convert to vectors
  const vectors = profiles.map(profileToVector);

  // Run K-means with k=5
  console.log('\nRunning K-means clustering (k=5)...');
  // Run multiple times and pick best (lowest total distance)
  let bestResult: { centroids: number[][]; assignments: number[] } | null = null;
  let bestScore = Infinity;

  for (let run = 0; run < 10; run++) {
    const result = kMeans(vectors, 5);
    let totalDist = 0;
    for (let i = 0; i < vectors.length; i++) {
      totalDist += distance(vectors[i], result.centroids[result.assignments[i]]);
    }
    if (totalDist < bestScore) {
      bestScore = totalDist;
      bestResult = result;
    }
  }

  const { centroids, assignments } = bestResult!;

  // Map clusters to archetype names
  const clusterNames = mapClustersToArchetypes(centroids);

  // Print cluster stats
  console.log('\n' + '═'.repeat(70));
  console.log('  CLUSTER ANALYSIS');
  console.log('═'.repeat(70));

  const dimNames = [
    'taxBluff', 'stealBluff', 'assassinBluff', 'exchangeBluff',
    'contessaBluff', 'otherBlockBluff',
    'challengeRate', 'challengeSuccess',
    'safeActionFrac', 'aggressionIdx',
    'targetLeader', 'revengeRate',
  ];

  for (let c = 0; c < centroids.length; c++) {
    const count = assignments.filter(a => a === c).length;
    console.log(`\n  Cluster ${c} → ${clusterNames[c].toUpperCase()} (${count} profiles, ${(count / profiles.length * 100).toFixed(1)}%)`);
    for (let d = 0; d < PROFILE_DIMS; d++) {
      console.log(`    ${dimNames[d].padEnd(18)} ${centroids[c][d].toFixed(4)}`);
    }
  }

  // Output calibrated params
  console.log('\n\n' + '═'.repeat(70));
  console.log('  CALIBRATED BOT_PERSONALITIES');
  console.log('═'.repeat(70));
  console.log('\nexport const BOT_PERSONALITIES = {');

  for (let c = 0; c < centroids.length; c++) {
    const params = centroidToParams(centroids[c], clusterNames[c]);
    console.log(`  ${clusterNames[c]}: {`);
    for (const [key, value] of Object.entries(params)) {
      console.log(`    ${key}: ${typeof value === 'string' ? `'${value}'` : value},`);
    }
    console.log(`  },`);
  }
  console.log('};');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
