/**
 * Decode and analyze the treason games.json database.
 * Compares ~600k real human+AI Coup games with our optimal bot simulation.
 *
 * Filters out expansion ("inquisitors") games — original only.
 *
 * Usage: npx tsx scripts/analyze-treason.ts [path-to-games.json]
 */

import fs from 'fs';
import path from 'path';

// ─── Binary Encoding Constants ───

const TYPE_START_OF_TURN = 1;
const TYPE_ACTION = 2; // implicit (no type byte)
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
  influence: string[]; // role names, prefixed with '!' if revealed
}

interface StartOfTurnEvent {
  type: 'start_of_turn';
  whoseTurn: number;
  playerStates: PlayerState[];
}

interface ActionEvent {
  type: 'action';
  action: string;
  player: number; // whose turn it was
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
    // Check if we're expecting an implicit ACTION event
    if (expectAction) {
      const byte = buf[i++];
      const actionCode = (byte >> 4) & 0xF;
      const target = byte & 0xF;
      const actionDef = ACTION_MAP[actionCode];
      if (actionDef) {
        const evt: ActionEvent = {
          type: 'action',
          action: actionDef.action,
          player: lastTurnPlayer,
        };
        if (actionDef.targeted && target > 0) {
          evt.target = target;
        }
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
        // Read player states - we read pairs of bytes for each player
        // but need to handle variable player counts
        for (let p = 0; p < playerCount && i + 1 < buf.length; p++) {
          const cash = buf[i++];
          const infByte = buf[i++];
          const inf0 = decodeInfluence((infByte >> 4) & 0xF);
          const inf1 = decodeInfluence(infByte & 0xF);
          const influence = [inf0, inf1].filter(x => x !== '');
          playerStates.push({ cash, influence });
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
          const influence = [inf0, inf1].filter(x => x !== '');
          playerStates.push({ cash, influence });
        }
        events.push({ type: 'game_over', playerStates });
        break;
      }

      case TYPE_CHALLENGE_SUCCESS: {
        const challenger = lowNibble;
        const nextByte = buf[i++];
        const challenged = nextByte & 0xF;
        events.push({ type: 'challenge_success', challenger, challenged });
        break;
      }

      case TYPE_CHALLENGE_FAIL: {
        const challenger = lowNibble;
        const nextByte = buf[i++];
        const challenged = nextByte & 0xF;
        events.push({ type: 'challenge_fail', challenger, challenged });
        break;
      }

      case TYPE_BLOCK: {
        const blockingPlayer = lowNibble;
        const roleByte = buf[i++];
        const blockingRole = ROLES[roleByte] || 'unknown';
        events.push({ type: 'block', blockingPlayer, blockingRole });
        break;
      }

      case TYPE_PLAYER_LEFT: {
        events.push({ type: 'player_left', player: lowNibble });
        // After PLAYER_LEFT, the next event could still be an ACTION
        // if we were expecting one (player left between START_OF_TURN and ACTION)
        break;
      }

      default:
        // Unknown event type, skip
        break;
    }
  }

  return events;
}

// ─── Game Record from JSON ───

interface TreasonGame {
  _id: string;
  players: number;
  humanPlayers: number;
  type?: string;
  playerRank: string[];
  playerDisconnect: number[];
  gameStarted: number;
  gameFinished: number;
  gameType: string;
  events: string;
}

// ─── Analysis ───

interface AnalysisStats {
  totalGames: number;
  byPlayerCount: Map<number, number>;
  byHumanCount: Map<number, number>;

  // Action counts
  actionCounts: Record<string, number>;
  totalActions: number;

  // Challenges
  totalChallenges: number;
  successfulChallenges: number;

  // Blocks
  totalBlocks: number;
  blocksByRole: Record<string, number>;

  // Game length
  turnCounts: number[];

  // Bluff analysis: actions where the acting player didn't have the card
  bluffActions: Record<string, { total: number; bluffs: number }>;

  // Block bluffs
  bluffBlocks: Record<string, { total: number; bluffs: number }>;

  // Card holdings at win
  winnerCards: Record<string, number>;
  winnerCardTotal: number;

  // Cards sacrificed (influence loss)
  cardsSacrificed: Record<string, number>;

  // Exchange behavior
  exchangeCount: number;

  // Targeting
  totalTargetedActions: number;

  // Avg game duration
  durations: number[];
}

function analyzeGame(game: TreasonGame, stats: AnalysisStats): void {
  const events = unpackEvents(game.events, game.players);
  if (events.length === 0) return;

  stats.totalGames++;
  stats.byPlayerCount.set(game.players, (stats.byPlayerCount.get(game.players) || 0) + 1);
  stats.byHumanCount.set(game.humanPlayers, (stats.byHumanCount.get(game.humanPlayers) || 0) + 1);

  const duration = game.gameFinished - game.gameStarted;
  stats.durations.push(duration);

  let turnCount = 0;
  let lastStartEvent: StartOfTurnEvent | null = null;
  let lastAction: ActionEvent | null = null;

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];

    switch (evt.type) {
      case 'start_of_turn': {
        turnCount++;
        lastStartEvent = evt;
        lastAction = null;
        break;
      }

      case 'action': {
        lastAction = evt;
        stats.actionCounts[evt.action] = (stats.actionCounts[evt.action] || 0) + 1;
        stats.totalActions++;

        if (evt.target !== undefined) {
          stats.totalTargetedActions++;
        }

        // Check for bluff: did the acting player have the required character?
        if (lastStartEvent && evt.player < lastStartEvent.playerStates.length) {
          const playerState = lastStartEvent.playerStates[evt.player];
          const actionToRole: Record<string, string> = {
            'tax': 'duke',
            'steal': 'captain',
            'assassinate': 'assassin',
            'exchange': 'ambassador',
          };
          const requiredRole = actionToRole[evt.action];
          if (requiredRole) {
            if (!stats.bluffActions[evt.action]) {
              stats.bluffActions[evt.action] = { total: 0, bluffs: 0 };
            }
            stats.bluffActions[evt.action].total++;

            // Check if player has the required role (unrevealed)
            const hasRole = playerState.influence.some(
              inf => inf === requiredRole // not revealed (no ! prefix)
            );
            if (!hasRole) {
              stats.bluffActions[evt.action].bluffs++;
            }
          }
        }
        break;
      }

      case 'challenge_success':
        stats.totalChallenges++;
        stats.successfulChallenges++;
        break;

      case 'challenge_fail':
        stats.totalChallenges++;
        break;

      case 'block': {
        stats.totalBlocks++;
        stats.blocksByRole[evt.blockingRole] = (stats.blocksByRole[evt.blockingRole] || 0) + 1;

        // Check for block bluff
        // The blocker is the blockingPlayer, but due to a bug it's always 0.
        // For targeted actions, the blocker is the target of the last action.
        // For foreign-aid, we can't determine the blocker from the block event alone.
        let blockerIndex: number | null = null;
        if (lastAction && lastAction.target !== undefined) {
          blockerIndex = lastAction.target;
        }
        // For foreign-aid blocks, try the next challenge event to identify blocker
        if (blockerIndex === null && lastAction?.action === 'foreign-aid') {
          // Look ahead for a challenge that identifies the blocker
          for (let j = i + 1; j < events.length && j < i + 4; j++) {
            const next = events[j];
            if (next.type === 'challenge_success' || next.type === 'challenge_fail') {
              blockerIndex = next.challenged;
              break;
            }
            if (next.type === 'start_of_turn' || next.type === 'game_over') break;
          }
        }

        if (blockerIndex !== null && lastStartEvent && blockerIndex < lastStartEvent.playerStates.length) {
          const blockerState = lastStartEvent.playerStates[blockerIndex];
          const role = evt.blockingRole;
          if (!stats.bluffBlocks[role]) {
            stats.bluffBlocks[role] = { total: 0, bluffs: 0 };
          }
          stats.bluffBlocks[role].total++;
          const hasRole = blockerState.influence.some(inf => inf === role);
          if (!hasRole) {
            stats.bluffBlocks[role].bluffs++;
          }
        }
        break;
      }

      case 'game_over': {
        // Find the winner and their cards
        const winnerIndex = game.playerRank.indexOf(
          game.playerRank.find(r => r !== 'ai') || game.playerRank[0]
        );

        // Actually, find the player who is still alive (has unrevealed influence)
        for (let p = 0; p < evt.playerStates.length; p++) {
          const ps = evt.playerStates[p];
          const aliveCards = ps.influence.filter(inf => !inf.startsWith('!'));
          if (aliveCards.length > 0 && ps.cash > 0) {
            for (const card of aliveCards) {
              stats.winnerCards[card] = (stats.winnerCards[card] || 0) + 1;
              stats.winnerCardTotal++;
            }
            break; // Only one winner
          }
        }

        // Count all revealed cards across all players (cards that were "sacrificed")
        for (const ps of evt.playerStates) {
          for (const inf of ps.influence) {
            if (inf.startsWith('!')) {
              const role = inf.slice(1);
              stats.cardsSacrificed[role] = (stats.cardsSacrificed[role] || 0) + 1;
            }
          }
        }
        break;
      }
    }
  }

  stats.turnCounts.push(turnCount);
  if (events.some(e => e.type === 'action' && (e as ActionEvent).action === 'exchange')) {
    stats.exchangeCount++;
  }
}

// ─── Output ───

function printComparison(treason: AnalysisStats): void {
  // Our simulation stats (hardcoded from the 50-game run)
  const ours = {
    games: 50,
    avgTurns: 22.8,
    actions: {
      'tax': 7.8, 'steal': 5.2, 'income': 3.2, 'exchange': 2.7,
      'assassinate': 1.8, 'coup': 1.2, 'foreign-aid': 0.8,
    },
    challengeSuccessRate: 51.0,
    challengesPerGame: 7.1,
    blocksPerGame: 5.1,
    bluffRates: {
      'tax': 47.6, 'steal': 37.0, 'assassinate': 52.7, 'exchange': 42.9,
    },
    blockBluffRates: {
      'duke': 31.3, 'captain': 47.7, 'ambassador': 43.6, 'contessa': 72.7,
    },
    winnerCards: {
      'captain': 19, 'duke': 15, 'ambassador': 11, 'assassin': 9, 'contessa': 7,
    },
    sacrificed: {
      'assassin': 25.3, 'contessa': 23.3, 'ambassador': 22.3, 'duke': 14.7, 'captain': 14.3,
    },
  };

  console.log('\n' + '═'.repeat(80));
  console.log('  TREASON DATABASE vs OUR HARD BOT SIMULATION');
  console.log('═'.repeat(80));

  // ─── Dataset Overview ───
  console.log('\n  ── Dataset Overview ──\n');
  console.log(`    Treason games (original only): ${treason.totalGames.toLocaleString()}`);
  console.log(`    Our simulation:                ${ours.games} games (5 optimal bots)`);

  console.log('\n    Treason by player count:');
  for (const [count, num] of [...treason.byPlayerCount.entries()].sort((a, b) => a[0] - b[0])) {
    const pct = ((num / treason.totalGames) * 100).toFixed(1);
    console.log(`      ${count}P: ${num.toLocaleString()} (${pct}%)`);
  }

  console.log('\n    Treason by human player count:');
  for (const [count, num] of [...treason.byHumanCount.entries()].sort((a, b) => a[0] - b[0])) {
    const pct = ((num / treason.totalGames) * 100).toFixed(1);
    console.log(`      ${count} humans: ${num.toLocaleString()} (${pct}%)`);
  }

  // ─── Game Length ───
  console.log('\n  ── Game Length ──\n');
  const tAvg = treason.turnCounts.reduce((a, b) => a + b, 0) / treason.turnCounts.length;
  const tMin = Math.min(...treason.turnCounts);
  const tMax = Math.max(...treason.turnCounts);
  // Median
  const sorted = [...treason.turnCounts].sort((a, b) => a - b);
  const tMedian = sorted[Math.floor(sorted.length / 2)];

  console.log(`                      Treason         Ours`);
  console.log(`    Avg turns:        ${tAvg.toFixed(1).padStart(6)}          ${ours.avgTurns.toFixed(1).padStart(6)}`);
  console.log(`    Median turns:     ${String(tMedian).padStart(6)}          ${'--'.padStart(6)}`);
  console.log(`    Min / Max:        ${tMin} / ${tMax}          11 / 41`);

  const tAvgDur = treason.durations.reduce((a, b) => a + b, 0) / treason.durations.length;
  console.log(`    Avg duration:     ${(tAvgDur / 1000).toFixed(0)}s            instant`);

  // ─── Action Distribution ───
  console.log('\n  ── Action Distribution (avg per game) ──\n');
  const actionOrder = ['tax', 'steal', 'income', 'exchange', 'assassinate', 'coup', 'foreign-aid'];
  const ourActionNames: Record<string, string> = {
    'tax': 'Tax', 'steal': 'Steal', 'income': 'Income', 'exchange': 'Exchange',
    'assassinate': 'Assassinate', 'coup': 'Coup', 'foreign-aid': 'ForeignAid',
  };

  console.log(`    ${'Action'.padEnd(16)} ${'Treason'.padStart(8)} ${'Ours'.padStart(8)}  ${'Delta'.padStart(8)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(8)} ${'─'.repeat(8)}  ${'─'.repeat(8)}`);
  for (const action of actionOrder) {
    const tCount = treason.actionCounts[action] || 0;
    const tAvgAction = tCount / treason.totalGames;
    const oKey = ourActionNames[action] || action;
    const oAvg = (ours.actions as any)[action] || 0;
    const delta = oAvg - tAvgAction;
    const sign = delta >= 0 ? '+' : '';
    console.log(`    ${action.padEnd(16)} ${tAvgAction.toFixed(1).padStart(8)} ${oAvg.toFixed(1).padStart(8)}  ${(sign + delta.toFixed(1)).padStart(8)}`);
  }

  // ─── Challenge Stats ───
  console.log('\n  ── Challenge Stats ──\n');
  const tChallengesPerGame = treason.totalChallenges / treason.totalGames;
  const tChallengeSuccessRate = treason.totalChallenges > 0
    ? (treason.successfulChallenges / treason.totalChallenges * 100) : 0;

  console.log(`                          Treason         Ours`);
  console.log(`    Challenges/game:      ${tChallengesPerGame.toFixed(1).padStart(6)}          ${ours.challengesPerGame.toFixed(1).padStart(6)}`);
  console.log(`    Success rate:         ${tChallengeSuccessRate.toFixed(1).padStart(5)}%         ${ours.challengeSuccessRate.toFixed(1).padStart(5)}%`);

  // ─── Block Stats ───
  console.log('\n  ── Block Stats ──\n');
  const tBlocksPerGame = treason.totalBlocks / treason.totalGames;
  console.log(`                          Treason         Ours`);
  console.log(`    Blocks/game:          ${tBlocksPerGame.toFixed(1).padStart(6)}          ${ours.blocksPerGame.toFixed(1).padStart(6)}`);

  console.log('\n    Blocks by character:');
  console.log(`    ${'Character'.padEnd(16)} ${'Treason'.padStart(10)} ${'Treason %'.padStart(10)}`);
  const totalTBlocks = treason.totalBlocks;
  for (const role of ['duke', 'captain', 'ambassador', 'contessa']) {
    const count = treason.blocksByRole[role] || 0;
    const pct = totalTBlocks > 0 ? (count / totalTBlocks * 100).toFixed(1) : '0.0';
    console.log(`    ${role.padEnd(16)} ${String(count.toLocaleString()).padStart(10)} ${(pct + '%').padStart(10)}`);
  }

  // ─── Bluff Rates ───
  console.log('\n  ── Action Bluff Rates ──\n');
  console.log(`    ${'Action'.padEnd(16)} ${'Treason'.padStart(10)} ${'Ours'.padStart(10)}  ${'Delta'.padStart(8)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(10)} ${'─'.repeat(10)}  ${'─'.repeat(8)}`);
  for (const action of ['tax', 'steal', 'assassinate', 'exchange']) {
    const tRec = treason.bluffActions[action];
    const tRate = tRec ? (tRec.bluffs / tRec.total * 100) : 0;
    const oRate = (ours.bluffRates as any)[action] || 0;
    const delta = oRate - tRate;
    const sign = delta >= 0 ? '+' : '';
    console.log(`    ${action.padEnd(16)} ${(tRate.toFixed(1) + '%').padStart(10)} ${(oRate.toFixed(1) + '%').padStart(10)}  ${(sign + delta.toFixed(1)).padStart(8)}`);
  }

  // ─── Block Bluff Rates ───
  console.log('\n  ── Block Bluff Rates ──\n');
  console.log(`    ${'Character'.padEnd(16)} ${'Treason'.padStart(10)} ${'Ours'.padStart(10)}  ${'Delta'.padStart(8)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(10)} ${'─'.repeat(10)}  ${'─'.repeat(8)}`);
  for (const role of ['duke', 'captain', 'ambassador', 'contessa']) {
    const tRec = treason.bluffBlocks[role];
    const tRate = tRec ? (tRec.bluffs / tRec.total * 100) : 0;
    const oRate = (ours.blockBluffRates as any)[role] || 0;
    const delta = oRate - tRate;
    const sign = delta >= 0 ? '+' : '';
    console.log(`    ${role.padEnd(16)} ${(tRate.toFixed(1) + '%').padStart(10)} ${(oRate.toFixed(1) + '%').padStart(10)}  ${(sign + delta.toFixed(1)).padStart(8)}`);
  }

  // ─── Winner Cards ───
  console.log('\n  ── Winner Card Holdings (unrevealed at game end) ──\n');
  console.log(`    ${'Card'.padEnd(16)} ${'Treason %'.padStart(10)} ${'Ours %'.padStart(10)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(10)} ${'─'.repeat(10)}`);
  const totalOursWinnerCards = Object.values(ours.winnerCards).reduce((a, b) => a + b, 0);
  for (const role of ['duke', 'captain', 'assassin', 'ambassador', 'contessa']) {
    const tCount = treason.winnerCards[role] || 0;
    const tPct = treason.winnerCardTotal > 0 ? (tCount / treason.winnerCardTotal * 100) : 0;
    const oCount = (ours.winnerCards as any)[role] || 0;
    const oPct = totalOursWinnerCards > 0 ? (oCount / totalOursWinnerCards * 100) : 0;
    console.log(`    ${role.padEnd(16)} ${(tPct.toFixed(1) + '%').padStart(10)} ${(oPct.toFixed(1) + '%').padStart(10)}`);
  }

  // ─── Cards Sacrificed ───
  console.log('\n  ── Cards Sacrificed (revealed during game) ──\n');
  const totalTSacrificed = Object.values(treason.cardsSacrificed).reduce((a, b) => a + b, 0);
  console.log(`    ${'Card'.padEnd(16)} ${'Treason %'.padStart(10)} ${'Ours %'.padStart(10)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(10)} ${'─'.repeat(10)}`);
  for (const role of ['duke', 'captain', 'assassin', 'ambassador', 'contessa']) {
    const tCount = treason.cardsSacrificed[role] || 0;
    const tPct = totalTSacrificed > 0 ? (tCount / totalTSacrificed * 100) : 0;
    const oPct = (ours.sacrificed as any)[role] || 0;
    console.log(`    ${role.padEnd(16)} ${(tPct.toFixed(1) + '%').padStart(10)} ${(oPct.toFixed(1) + '%').padStart(10)}`);
  }
}

// ─── Main ───

async function main() {
  const filePath = process.argv[2] || path.join(process.env.HOME || '', 'Documents', 'games.json');

  console.log(`\nReading ${filePath}...`);
  console.log('(This is a 460MB file, streaming line-by-line...)\n');

  const stats: AnalysisStats = {
    totalGames: 0,
    byPlayerCount: new Map(),
    byHumanCount: new Map(),
    actionCounts: {},
    totalActions: 0,
    totalChallenges: 0,
    successfulChallenges: 0,
    totalBlocks: 0,
    blocksByRole: {},
    turnCounts: [],
    bluffActions: {},
    bluffBlocks: {},
    winnerCards: {},
    winnerCardTotal: 0,
    cardsSacrificed: {},
    exchangeCount: 0,
    totalTargetedActions: 0,
    durations: [],
  };

  // Stream the file since it's 460MB
  const content = fs.readFileSync(filePath, 'utf-8');

  // The file is a JSON array of game objects
  // Parse the whole thing (it's ~460MB, should fit in memory with 4GB+ heap)
  console.log('Parsing JSON...');
  const games: TreasonGame[] = JSON.parse(content);
  console.log(`Total games in file: ${games.length.toLocaleString()}`);

  // Filter out null/invalid entries, then original game type only (no expansion)
  const validGames = games.filter(g => g != null && g.gameType);
  console.log(`Valid games (non-null): ${validGames.length.toLocaleString()}`);
  const originalGames = validGames.filter(g => g.gameType === 'original');
  console.log(`Original games (excluding inquisitors): ${originalGames.length.toLocaleString()}`);

  // Also filter out games where players disconnected (for cleaner data)
  const cleanGames = originalGames.filter(g =>
    g.playerDisconnect.length === 0 && g.events && g.events.length > 0
  );
  console.log(`Clean games (no disconnects): ${cleanGames.length.toLocaleString()}`);

  console.log('\nAnalyzing...');
  let processed = 0;
  const reportInterval = Math.max(1, Math.floor(cleanGames.length / 20));

  for (const game of cleanGames) {
    try {
      analyzeGame(game, stats);
    } catch (err) {
      // Skip malformed games silently
    }
    processed++;
    if (processed % reportInterval === 0) {
      const pct = ((processed / cleanGames.length) * 100).toFixed(0);
      process.stdout.write(`  ${pct}% (${processed.toLocaleString()} games)\r`);
    }
  }
  console.log(`  100% (${processed.toLocaleString()} games)\n`);

  // Also do a 5-player-only analysis for apples-to-apples comparison
  console.log('Running 5-player-only analysis for direct comparison...');
  const fivePlayerStats: AnalysisStats = {
    totalGames: 0,
    byPlayerCount: new Map(),
    byHumanCount: new Map(),
    actionCounts: {},
    totalActions: 0,
    totalChallenges: 0,
    successfulChallenges: 0,
    totalBlocks: 0,
    blocksByRole: {},
    turnCounts: [],
    bluffActions: {},
    bluffBlocks: {},
    winnerCards: {},
    winnerCardTotal: 0,
    cardsSacrificed: {},
    exchangeCount: 0,
    totalTargetedActions: 0,
    durations: [],
  };

  const fivePlayerGames = cleanGames.filter(g => g.players === 5);
  console.log(`5-player clean original games: ${fivePlayerGames.length.toLocaleString()}\n`);
  for (const game of fivePlayerGames) {
    try {
      analyzeGame(game, fivePlayerStats);
    } catch {}
  }

  // Print full comparison using 5-player stats
  printComparison(fivePlayerStats);

  // Also print the all-player-count stats for context
  console.log('\n\n' + '═'.repeat(80));
  console.log('  ALL ORIGINAL GAMES (any player count) — for context');
  console.log('═'.repeat(80));

  console.log(`\n  Total games analyzed: ${stats.totalGames.toLocaleString()}`);
  const allAvgTurns = stats.turnCounts.reduce((a, b) => a + b, 0) / stats.turnCounts.length;
  console.log(`  Avg turns: ${allAvgTurns.toFixed(1)}`);

  console.log('\n  Action distribution (avg/game):');
  for (const action of ['tax', 'steal', 'income', 'exchange', 'assassinate', 'coup', 'foreign-aid']) {
    const avg = (stats.actionCounts[action] || 0) / stats.totalGames;
    console.log(`    ${action.padEnd(16)} ${avg.toFixed(1)}`);
  }

  const allChallengeRate = stats.totalChallenges > 0
    ? (stats.successfulChallenges / stats.totalChallenges * 100).toFixed(1) : '0.0';
  console.log(`\n  Challenges: ${stats.totalChallenges.toLocaleString()} total, ${allChallengeRate}% successful`);
  console.log(`  Blocks: ${stats.totalBlocks.toLocaleString()} total (${(stats.totalBlocks / stats.totalGames).toFixed(1)}/game)`);
  console.log('');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
