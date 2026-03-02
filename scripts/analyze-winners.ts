/**
 * Winner-only analysis of the treason database.
 *
 * Isolates the winning player's actions, bluffs, challenges, and blocks
 * in each game and compares directly to our optimal bot simulation.
 *
 * Usage: npx tsx scripts/analyze-winners.ts [path-to-games.json]
 */

import fs from 'fs';
import path from 'path';

// ─── Binary Decoding (same as analyze-treason.ts) ───

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
      case 1: { // START_OF_TURN
        lastTurnPlayer = lowNibble;
        const playerStates: PlayerState[] = [];
        for (let p = 0; p < playerCount && i + 1 < buf.length; p++) {
          const cash = buf[i++];
          const infByte = buf[i++];
          const inf0 = decodeInfluence((infByte >> 4) & 0xF);
          const inf1 = decodeInfluence(infByte & 0xF);
          playerStates.push({ cash, influence: [inf0, inf1].filter(x => x !== '') });
        }
        events.push({ type: 'start_of_turn', whoseTurn: lowNibble, playerStates });
        expectAction = true;
        break;
      }
      case 7: { // GAME_OVER
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
      case 3: case 4: { // CHALLENGE_SUCCESS / CHALLENGE_FAIL
        const nextByte = buf[i++];
        events.push({
          type: eventType === 3 ? 'challenge_success' : 'challenge_fail',
          challenger: lowNibble,
          challenged: nextByte & 0xF,
        });
        break;
      }
      case 5: { // BLOCK
        const roleByte = buf[i++];
        events.push({ type: 'block', blockingPlayer: lowNibble, blockingRole: ROLES[roleByte] || 'unknown' });
        break;
      }
      case 6: { // PLAYER_LEFT
        events.push({ type: 'player_left', player: lowNibble });
        break;
      }
    }
  }
  return events;
}

// ─── Game Record ───

interface TreasonGame {
  _id: string;
  players: number;
  humanPlayers: number;
  playerRank: string[];
  playerDisconnect: number[];
  gameStarted: number;
  gameFinished: number;
  gameType: string;
  events: string;
}

// ─── Winner-Only Stats ───

interface WinnerStats {
  totalGames: number;

  // Winner's actions
  actionCounts: Record<string, number>;
  totalActions: number;

  // Winner's action bluff rates
  bluffActions: Record<string, { total: number; bluffs: number }>;

  // Winner's challenges (as challenger)
  challengesIssued: number;
  challengesSucceeded: number; // winner challenged and was right
  challengesFailed: number;    // winner challenged and was wrong

  // Winner was challenged
  timesChallenged: number;
  timesWhenChallengedWasHonest: number; // opponent challenged, winner had the card
  timesWhenChallengedWasBluffing: number; // opponent challenged, winner didn't have it

  // Winner's blocks
  blocksIssued: number;
  blocksByRole: Record<string, number>;
  bluffBlocks: Record<string, { total: number; bluffs: number }>;

  // Winner was blocked
  timesBlocked: number;

  // Winner's challenge-block behavior (challenging opponents' blocks)
  blockChallengesIssued: number;
  blockChallengesSucceeded: number;

  // Winner card holdings at end
  winnerCards: Record<string, number>;
  winnerCardTotal: number;

  // Winner starting cards
  winnerStartCards: Record<string, number>;
  winnerStartTotal: number;

  // Game turns when winner acted
  winnerTurnCounts: number[];

  // Actions per turn distribution
  actionsByPhase: { early: Record<string, number>; mid: Record<string, number>; late: Record<string, number> };
  phaseActions: { early: number; mid: number; late: number };

  // How winner is targeted
  timesTargeted: number;
  targetedByAction: Record<string, number>;

  // Winner's targeting
  winnerTargets: number;

  // Human vs AI winners
  humanWins: number;
  aiWins: number;
}

function newWinnerStats(): WinnerStats {
  return {
    totalGames: 0,
    actionCounts: {}, totalActions: 0,
    bluffActions: {},
    challengesIssued: 0, challengesSucceeded: 0, challengesFailed: 0,
    timesChallenged: 0, timesWhenChallengedWasHonest: 0, timesWhenChallengedWasBluffing: 0,
    blocksIssued: 0, blocksByRole: {},
    bluffBlocks: {},
    timesBlocked: 0,
    blockChallengesIssued: 0, blockChallengesSucceeded: 0,
    winnerCards: {}, winnerCardTotal: 0,
    winnerStartCards: {}, winnerStartTotal: 0,
    winnerTurnCounts: [],
    actionsByPhase: { early: {}, mid: {}, late: {} },
    phaseActions: { early: 0, mid: 0, late: 0 },
    timesTargeted: 0, targetedByAction: {},
    winnerTargets: 0,
    humanWins: 0, aiWins: 0,
  };
}

const ACTION_TO_ROLE: Record<string, string> = {
  'tax': 'duke', 'steal': 'captain', 'assassinate': 'assassin', 'exchange': 'ambassador',
};

function analyzeWinner(game: TreasonGame, stats: WinnerStats): void {
  const events = unpackEvents(game.events, game.players);
  if (events.length === 0) return;

  // Find the winner: the alive player at GAME_OVER
  const gameOver = events.find(e => e.type === 'game_over') as GameOverEvent | undefined;
  if (!gameOver) return;

  let winnerIndex = -1;
  for (let p = 0; p < gameOver.playerStates.length; p++) {
    const ps = gameOver.playerStates[p];
    const alive = ps.influence.filter(inf => !inf.startsWith('!'));
    if (alive.length > 0) {
      winnerIndex = p;
      break;
    }
  }
  if (winnerIndex === -1) return;

  stats.totalGames++;

  // Human or AI?
  const isHuman = game.playerRank[winnerIndex] !== 'ai';
  if (isHuman) stats.humanWins++;
  else stats.aiWins++;

  // Winner's end cards
  const endCards = gameOver.playerStates[winnerIndex].influence.filter(inf => !inf.startsWith('!'));
  for (const card of endCards) {
    stats.winnerCards[card] = (stats.winnerCards[card] || 0) + 1;
    stats.winnerCardTotal++;
  }

  // Winner's starting cards (from first START_OF_TURN)
  const firstTurn = events.find(e => e.type === 'start_of_turn') as StartOfTurnEvent | undefined;
  if (firstTurn && winnerIndex < firstTurn.playerStates.length) {
    const startInf = firstTurn.playerStates[winnerIndex].influence.filter(inf => !inf.startsWith('!'));
    for (const card of startInf) {
      stats.winnerStartCards[card] = (stats.winnerStartCards[card] || 0) + 1;
      stats.winnerStartTotal++;
    }
  }

  // Count total turns to determine early/mid/late phases
  let totalTurns = 0;
  for (const e of events) {
    if (e.type === 'start_of_turn') totalTurns++;
  }

  let turnCount = 0;
  let winnerTurns = 0;
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

        // Is winner acting?
        if (evt.player === winnerIndex) {
          winnerTurns++;
          stats.actionCounts[evt.action] = (stats.actionCounts[evt.action] || 0) + 1;
          stats.totalActions++;

          if (evt.target !== undefined) {
            stats.winnerTargets++;
          }

          // Phase classification
          const progress = totalTurns > 0 ? turnCount / totalTurns : 0;
          let phase: 'early' | 'mid' | 'late';
          if (progress <= 0.33) phase = 'early';
          else if (progress <= 0.66) phase = 'mid';
          else phase = 'late';

          stats.actionsByPhase[phase][evt.action] = (stats.actionsByPhase[phase][evt.action] || 0) + 1;
          stats.phaseActions[phase]++;

          // Bluff check
          if (lastStartEvent && evt.player < lastStartEvent.playerStates.length) {
            const playerState = lastStartEvent.playerStates[evt.player];
            const requiredRole = ACTION_TO_ROLE[evt.action];
            if (requiredRole) {
              if (!stats.bluffActions[evt.action]) stats.bluffActions[evt.action] = { total: 0, bluffs: 0 };
              stats.bluffActions[evt.action].total++;
              const hasRole = playerState.influence.some(inf => inf === requiredRole);
              if (!hasRole) stats.bluffActions[evt.action].bluffs++;
            }
          }
        }

        // Is winner being targeted?
        if (evt.target === winnerIndex) {
          stats.timesTargeted++;
          stats.targetedByAction[evt.action] = (stats.targetedByAction[evt.action] || 0) + 1;
        }
        break;
      }

      case 'challenge_success': {
        // Challenger was right (the claim was a bluff)
        if (evt.challenger === winnerIndex) {
          stats.challengesIssued++;
          stats.challengesSucceeded++;
        }
        if (evt.challenged === winnerIndex) {
          // Winner was challenged and was bluffing
          stats.timesChallenged++;
          stats.timesWhenChallengedWasBluffing++;
        }
        break;
      }

      case 'challenge_fail': {
        // Challenger was wrong (the claim was honest)
        if (evt.challenger === winnerIndex) {
          stats.challengesIssued++;
          stats.challengesFailed++;
        }
        if (evt.challenged === winnerIndex) {
          // Winner was challenged and was honest
          stats.timesChallenged++;
          stats.timesWhenChallengedWasHonest++;
        }
        break;
      }

      case 'block': {
        // Determine actual blocker
        let blockerIndex: number | null = null;
        if (lastAction && lastAction.target !== undefined) {
          blockerIndex = lastAction.target;
        }
        if (blockerIndex === null && lastAction?.action === 'foreign-aid') {
          for (let j = i + 1; j < events.length && j < i + 4; j++) {
            const next = events[j];
            if (next.type === 'challenge_success' || next.type === 'challenge_fail') {
              blockerIndex = next.challenged;
              break;
            }
            if (next.type === 'start_of_turn' || next.type === 'game_over') break;
          }
        }

        if (blockerIndex === winnerIndex) {
          // Winner is blocking
          stats.blocksIssued++;
          stats.blocksByRole[evt.blockingRole] = (stats.blocksByRole[evt.blockingRole] || 0) + 1;

          // Bluff block check
          if (lastStartEvent && blockerIndex < lastStartEvent.playerStates.length) {
            const blockerState = lastStartEvent.playerStates[blockerIndex];
            const role = evt.blockingRole;
            if (!stats.bluffBlocks[role]) stats.bluffBlocks[role] = { total: 0, bluffs: 0 };
            stats.bluffBlocks[role].total++;
            if (!blockerState.influence.some(inf => inf === role)) {
              stats.bluffBlocks[role].bluffs++;
            }
          }
        }

        // Winner's action was blocked
        if (lastAction && lastAction.player === winnerIndex) {
          stats.timesBlocked++;
        }

        // Check if winner challenge-blocks in subsequent events
        for (let j = i + 1; j < events.length && j < i + 4; j++) {
          const next = events[j];
          if (next.type === 'challenge_success' && next.challenger === winnerIndex) {
            stats.blockChallengesIssued++;
            stats.blockChallengesSucceeded++;
            break;
          }
          if (next.type === 'challenge_fail' && next.challenger === winnerIndex) {
            stats.blockChallengesIssued++;
            break;
          }
          if (next.type === 'start_of_turn' || next.type === 'game_over' || next.type === 'action') break;
        }
        break;
      }
    }
  }

  stats.winnerTurnCounts.push(winnerTurns);
}

// ─── Print ───

function printResults(stats: WinnerStats): void {
  const g = stats.totalGames;

  console.log('\n' + '='.repeat(80));
  console.log('  TREASON WINNERS vs OUR HARD BOTS — Strategy Comparison');
  console.log('='.repeat(80));

  console.log(`\n  Games analyzed: ${g.toLocaleString()}`);
  console.log(`  Human winners: ${stats.humanWins.toLocaleString()} (${(stats.humanWins/g*100).toFixed(1)}%)`);
  console.log(`  AI winners:    ${stats.aiWins.toLocaleString()} (${(stats.aiWins/g*100).toFixed(1)}%)`);

  const avgWinnerTurns = stats.winnerTurnCounts.reduce((a,b)=>a+b,0) / g;
  console.log(`  Avg turns taken by winner: ${avgWinnerTurns.toFixed(1)}`);

  // ─── Action Profile ───
  console.log('\n  ── Winner Action Profile (avg per game) ──\n');

  // Our optimal bot per-player action rates (50 games, 5 bots each, ~22.8 turns avg)
  // From the simulation: each bot takes ~4.6 turns per game on average
  // Total actions: Tax 7.8, Steal 5.2, Income 3.2, Exchange 2.7, Assassinate 1.8, Coup 1.2, FA 0.8
  // Per player: divide by 5
  const oursPerPlayer: Record<string, number> = {
    'tax': 7.8/5, 'steal': 5.2/5, 'income': 3.2/5, 'exchange': 2.7/5,
    'assassinate': 1.8/5, 'coup': 1.2/5, 'foreign-aid': 0.8/5,
  };

  const actionOrder = ['tax', 'steal', 'income', 'exchange', 'assassinate', 'coup', 'foreign-aid'];

  console.log(`    ${'Action'.padEnd(16)} ${'Treason Winner'.padStart(15)} ${'Our Bot (avg)'.padStart(14)}  ${'Delta'.padStart(8)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(15)} ${'─'.repeat(14)}  ${'─'.repeat(8)}`);

  for (const action of actionOrder) {
    const tAvg = (stats.actionCounts[action] || 0) / g;
    const oAvg = oursPerPlayer[action] || 0;
    const delta = oAvg - tAvg;
    const sign = delta >= 0 ? '+' : '';
    console.log(
      `    ${action.padEnd(16)} ${tAvg.toFixed(2).padStart(15)} ${oAvg.toFixed(2).padStart(14)}  ${(sign + delta.toFixed(2)).padStart(8)}`
    );
  }

  // Action share (% of total actions)
  console.log('\n  ── Winner Action Share (% of all their actions) ──\n');
  const oursTotal = Object.values(oursPerPlayer).reduce((a,b)=>a+b,0);

  console.log(`    ${'Action'.padEnd(16)} ${'Treason Winner'.padStart(15)} ${'Our Bot'.padStart(10)}  ${'Delta'.padStart(8)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(15)} ${'─'.repeat(10)}  ${'─'.repeat(8)}`);

  for (const action of actionOrder) {
    const tPct = stats.totalActions > 0 ? ((stats.actionCounts[action] || 0) / stats.totalActions * 100) : 0;
    const oPct = oursTotal > 0 ? ((oursPerPlayer[action] || 0) / oursTotal * 100) : 0;
    const delta = oPct - tPct;
    const sign = delta >= 0 ? '+' : '';
    console.log(
      `    ${action.padEnd(16)} ${(tPct.toFixed(1)+'%').padStart(15)} ${(oPct.toFixed(1)+'%').padStart(10)}  ${(sign + delta.toFixed(1)).padStart(8)}`
    );
  }

  // ─── Bluff Rates ───
  console.log('\n  ── Winner Action Bluff Rates ──\n');
  const oursBluff: Record<string, number> = {
    'tax': 47.6, 'steal': 37.0, 'assassinate': 52.7, 'exchange': 42.9,
  };

  console.log(`    ${'Action'.padEnd(16)} ${'Treason Winner'.padStart(15)} ${'Our Bot'.padStart(10)}  ${'Delta'.padStart(8)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(15)} ${'─'.repeat(10)}  ${'─'.repeat(8)}`);

  for (const action of ['tax', 'steal', 'assassinate', 'exchange']) {
    const rec = stats.bluffActions[action];
    const tRate = rec ? (rec.bluffs / rec.total * 100) : 0;
    const oRate = oursBluff[action] || 0;
    const delta = oRate - tRate;
    const sign = delta >= 0 ? '+' : '';
    console.log(
      `    ${action.padEnd(16)} ${(tRate.toFixed(1)+'%').padStart(15)} ${(oRate.toFixed(1)+'%').padStart(10)}  ${(sign + delta.toFixed(1)).padStart(8)}`
    );
    if (rec) {
      console.log(`      (${rec.total} claims, ${rec.bluffs} bluffs, ${rec.total - rec.bluffs} honest)`);
    }
  }

  // ─── Block Bluff Rates ───
  console.log('\n  ── Winner Block Bluff Rates ──\n');
  const oursBlockBluff: Record<string, number> = {
    'duke': 31.3, 'captain': 47.7, 'ambassador': 43.6, 'contessa': 72.7,
  };

  console.log(`    ${'Character'.padEnd(16)} ${'Treason Winner'.padStart(15)} ${'Our Bot'.padStart(10)}  ${'Delta'.padStart(8)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(15)} ${'─'.repeat(10)}  ${'─'.repeat(8)}`);

  for (const role of ['duke', 'captain', 'ambassador', 'contessa']) {
    const rec = stats.bluffBlocks[role];
    const tRate = rec ? (rec.bluffs / rec.total * 100) : 0;
    const oRate = oursBlockBluff[role] || 0;
    const delta = oRate - tRate;
    const sign = delta >= 0 ? '+' : '';
    console.log(
      `    ${role.padEnd(16)} ${(tRate.toFixed(1)+'%').padStart(15)} ${(oRate.toFixed(1)+'%').padStart(10)}  ${(sign + delta.toFixed(1)).padStart(8)}`
    );
    if (rec) {
      console.log(`      (${rec.total} blocks, ${rec.bluffs} bluffs, ${rec.total - rec.bluffs} honest)`);
    }
  }

  // ─── Challenge Behavior ───
  console.log('\n  ── Winner Challenge Behavior ──\n');

  const challengeSuccessRate = stats.challengesIssued > 0
    ? (stats.challengesSucceeded / stats.challengesIssued * 100) : 0;
  const challengesPerGame = stats.challengesIssued / g;

  console.log(`    Challenges issued by winner:  ${stats.challengesIssued.toLocaleString()} (${challengesPerGame.toFixed(2)}/game)`);
  console.log(`    Successful (caught bluffs):   ${stats.challengesSucceeded.toLocaleString()} (${challengeSuccessRate.toFixed(1)}%)`);
  console.log(`    Failed (was honest):          ${stats.challengesFailed.toLocaleString()} (${(100 - challengeSuccessRate).toFixed(1)}%)`);
  console.log(`    Our bot challenge success:    51.0%`);

  console.log(`\n    Times winner was challenged:  ${stats.timesChallenged.toLocaleString()} (${(stats.timesChallenged / g).toFixed(2)}/game)`);
  const survivedRate = stats.timesChallenged > 0
    ? (stats.timesWhenChallengedWasHonest / stats.timesChallenged * 100) : 0;
  console.log(`    Winner was honest:            ${stats.timesWhenChallengedWasHonest.toLocaleString()} (${survivedRate.toFixed(1)}% — survived the challenge)`);
  console.log(`    Winner was bluffing:          ${stats.timesWhenChallengedWasBluffing.toLocaleString()} (${(100 - survivedRate).toFixed(1)}% — got caught)`);

  // ─── Block Behavior ───
  console.log('\n  ── Winner Block Behavior ──\n');

  console.log(`    Blocks issued by winner: ${stats.blocksIssued.toLocaleString()} (${(stats.blocksIssued / g).toFixed(2)}/game)`);
  for (const role of ['duke', 'captain', 'ambassador', 'contessa']) {
    const count = stats.blocksByRole[role] || 0;
    if (count > 0) {
      const pct = (count / stats.blocksIssued * 100).toFixed(1);
      console.log(`      ${role.padEnd(12)} ${String(count).padStart(6)} (${pct}%)`);
    }
  }
  console.log(`\n    Times winner's action was blocked: ${stats.timesBlocked.toLocaleString()} (${(stats.timesBlocked / g).toFixed(2)}/game)`);
  console.log(`    Winner challenged blocks:          ${stats.blockChallengesIssued.toLocaleString()}`);
  if (stats.blockChallengesIssued > 0) {
    console.log(`    Block challenges succeeded:        ${stats.blockChallengesSucceeded} (${(stats.blockChallengesSucceeded / stats.blockChallengesIssued * 100).toFixed(1)}%)`);
  }

  // ─── Targeting ───
  console.log('\n  ── How Winners Get Targeted ──\n');

  console.log(`    Times targeted: ${stats.timesTargeted.toLocaleString()} (${(stats.timesTargeted / g).toFixed(2)}/game)`);
  for (const action of ['steal', 'assassinate', 'coup']) {
    const count = stats.targetedByAction[action] || 0;
    if (count > 0 || stats.timesTargeted > 0) {
      const pct = stats.timesTargeted > 0 ? (count / stats.timesTargeted * 100).toFixed(1) : '0.0';
      console.log(`      ${action.padEnd(14)} ${String(count).padStart(6)} (${pct}%)`);
    }
  }

  // ─── Phase Analysis ───
  console.log('\n  ── Winner Action Mix by Game Phase ──\n');

  for (const phase of ['early', 'mid', 'late'] as const) {
    const phaseTotal = stats.phaseActions[phase];
    if (phaseTotal === 0) continue;
    console.log(`    ${phase.toUpperCase()} game (${phase === 'early' ? 'turns 1-33%' : phase === 'mid' ? 'turns 34-66%' : 'turns 67-100%'}):`);
    for (const action of actionOrder) {
      const count = stats.actionsByPhase[phase][action] || 0;
      if (count === 0) continue;
      const pct = (count / phaseTotal * 100).toFixed(1);
      console.log(`      ${action.padEnd(14)} ${(pct + '%').padStart(6)}`)
    }
    console.log();
  }

  // ─── Starting Cards ───
  console.log('  ── Winner Starting Cards ──\n');
  console.log(`    ${'Card'.padEnd(16)} ${'% of winner starts'.padStart(20)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(20)}`);
  for (const role of ['duke', 'captain', 'assassin', 'ambassador', 'contessa']) {
    const count = stats.winnerStartCards[role] || 0;
    const pct = stats.winnerStartTotal > 0 ? (count / stats.winnerStartTotal * 100).toFixed(1) : '0.0';
    console.log(`    ${role.padEnd(16)} ${(pct + '%').padStart(20)}`);
  }

  // ─── End Cards ───
  console.log('\n  ── Winner End Cards ──\n');
  const oursEndCards: Record<string, number> = { 'captain': 31.1, 'duke': 24.6, 'ambassador': 18.0, 'assassin': 14.8, 'contessa': 11.5 };

  console.log(`    ${'Card'.padEnd(16)} ${'Treason Winner'.padStart(15)} ${'Our Bot'.padStart(10)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(15)} ${'─'.repeat(10)}`);

  for (const role of ['duke', 'captain', 'assassin', 'ambassador', 'contessa']) {
    const count = stats.winnerCards[role] || 0;
    const tPct = stats.winnerCardTotal > 0 ? (count / stats.winnerCardTotal * 100) : 0;
    const oPct = oursEndCards[role] || 0;
    console.log(`    ${role.padEnd(16)} ${(tPct.toFixed(1) + '%').padStart(15)} ${(oPct.toFixed(1) + '%').padStart(10)}`);
  }

  console.log('');
}

// ─── Main ───

async function main() {
  const filePath = process.argv[2] || path.join(process.env.HOME || '', 'Documents', 'games.json');

  console.log(`\nReading ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log('Parsing JSON...');
  const games: TreasonGame[] = JSON.parse(content);
  console.log(`Total games: ${games.length.toLocaleString()}`);

  const valid = games.filter(g => g != null && g.gameType === 'original' &&
    g.playerDisconnect.length === 0 && g.events && g.events.length > 0);

  // 5-player only for direct comparison
  const fivePlayer = valid.filter(g => g.players === 5);
  console.log(`5-player original clean games: ${fivePlayer.length.toLocaleString()}`);

  // All winners
  const allStats = newWinnerStats();
  // Human winners only
  const humanStats = newWinnerStats();
  // 5-human (all-human lobby) winners
  const allHumanStats = newWinnerStats();

  console.log('\nAnalyzing winners...');

  for (const game of fivePlayer) {
    try {
      analyzeWinner(game, allStats);

      // Also track human-winner-only games
      const events = unpackEvents(game.events, game.players);
      const gameOver = events.find(e => e.type === 'game_over') as GameOverEvent | undefined;
      if (gameOver) {
        let winnerIdx = -1;
        for (let p = 0; p < gameOver.playerStates.length; p++) {
          if (gameOver.playerStates[p].influence.some(inf => !inf.startsWith('!'))) {
            winnerIdx = p;
            break;
          }
        }
        if (winnerIdx >= 0 && game.playerRank[winnerIdx] !== 'ai') {
          analyzeWinner(game, humanStats);
        }
        if (game.humanPlayers === 5 && winnerIdx >= 0) {
          analyzeWinner(game, allHumanStats);
        }
      }
    } catch {}
  }

  console.log(`\nAll winners analyzed: ${allStats.totalGames.toLocaleString()}`);
  console.log(`Human winners: ${humanStats.totalGames.toLocaleString()}`);
  console.log(`All-human lobby winners: ${allHumanStats.totalGames.toLocaleString()}`);

  // Print all winners
  console.log('\n\n' + '#'.repeat(80));
  console.log('  SECTION 1: ALL 5-PLAYER WINNERS (human + AI)');
  console.log('#'.repeat(80));
  printResults(allStats);

  // Print human winners
  console.log('\n\n' + '#'.repeat(80));
  console.log('  SECTION 2: HUMAN WINNERS ONLY (beat at least some opponents)');
  console.log('#'.repeat(80));
  printResults(humanStats);

  // Print all-human lobby
  if (allHumanStats.totalGames > 100) {
    console.log('\n\n' + '#'.repeat(80));
    console.log('  SECTION 3: ALL-HUMAN LOBBY WINNERS (5 humans, no AI)');
    console.log('#'.repeat(80));
    printResults(allHumanStats);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
