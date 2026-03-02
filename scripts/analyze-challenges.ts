/**
 * Analyze challenge behavior in treason data:
 * - How often do targets challenge vs bystanders?
 * - Broken down by action type (steal, assassinate, tax, exchange)
 * - Early game vs mid/late game
 * - Success rates for target vs bystander challenges
 *
 * Usage: npx tsx scripts/analyze-challenges.ts [path-to-games.json]
 */

import fs from 'fs';
import path from 'path';

// ─── Binary Encoding Constants ───

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

// ─── Decoder ───

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
        break;
      }

      default:
        break;
    }
  }

  return events;
}

// ─── Analysis ───

interface ChallengeStats {
  targetChallenges: number;
  targetSuccesses: number;
  bystanderChallenges: number;
  bystanderSuccesses: number;
  totalOpportunities: number; // how many times the action was played (denominator)
}

type ActionChallengeMap = Record<string, ChallengeStats>;

interface GamePhaseStats {
  early: ActionChallengeMap;  // turns 1-5
  mid: ActionChallengeMap;    // turns 6-15
  late: ActionChallengeMap;   // turns 16+
  all: ActionChallengeMap;
}

function emptyStats(): ChallengeStats {
  return { targetChallenges: 0, targetSuccesses: 0, bystanderChallenges: 0, bystanderSuccesses: 0, totalOpportunities: 0 };
}

function ensureAction(map: ActionChallengeMap, action: string): ChallengeStats {
  if (!map[action]) map[action] = emptyStats();
  return map[action];
}

// Also track: how many alive players when the challenge happens
interface AliveCountStats {
  challenges: number;
  byPlayer: number; // total alive count sum, divide by challenges for avg
}

function main() {
  const gamesPath = process.argv[2] || path.join(__dirname, '..', 'data', 'games.json');
  console.log(`Loading games from: ${gamesPath}`);
  const raw = JSON.parse(fs.readFileSync(gamesPath, 'utf-8'));

  // Filter: original games, 5 players, no disconnects, human games
  const games = raw.filter((g: any) =>
    g &&
    g.type === 'game' &&
    g.gameType === 'original' &&
    g.players === 5 &&
    (!g.playerDisconnect || g.playerDisconnect.length === 0) &&
    g.playerRank &&
    g.playerRank.some((r: string) => r !== 'ai')
  );
  console.log(`Filtered to ${games.length} 5-player original games with humans\n`);

  const phaseStats: GamePhaseStats = {
    early: {},
    mid: {},
    late: {},
    all: {},
  };

  // Track per-alive-count challenge rates
  const byAliveCount: Record<number, { target: number; bystander: number; opportunities: number }> = {};

  // Track: for targeted actions, how many players COULD challenge
  // and how many actually do — to get per-player challenge rates
  let totalTargetedActions = 0;
  let totalPotentialBystanders = 0; // sum of (aliveCount - 2) for each targeted action (actor + target excluded from bystanders)
  let totalBotVsHumanGames = 0;
  let humanOnlyGames = 0;

  for (const g of games) {
    const events = unpackEvents(g.events, g.players);
    const isAllHuman = g.playerRank.every((r: string) => r !== 'ai');
    if (isAllHuman) humanOnlyGames++;

    let turnNumber = 0;
    let lastAction: ActionEvent | null = null;
    let lastTurnStart: StartOfTurnEvent | null = null;
    let aliveCount = g.players;
    let isBlockChallenge = false; // track if we're in a block-challenge context

    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei];

      if (ev.type === 'start_of_turn') {
        turnNumber++;
        lastTurnStart = ev;
        lastAction = null;
        isBlockChallenge = false;
        // Count alive players from state
        aliveCount = ev.playerStates.filter(ps =>
          ps.influence.some(inf => !inf.startsWith('!') && inf !== '')
        ).length;
      }

      if (ev.type === 'action') {
        lastAction = ev;
        isBlockChallenge = false;

        // Count opportunity for challengeable actions
        const challengeable = ['tax', 'steal', 'assassinate', 'exchange'];
        if (challengeable.includes(ev.action)) {
          const phase = turnNumber <= 5 ? 'early' : turnNumber <= 15 ? 'mid' : 'late';
          ensureAction(phaseStats[phase], ev.action).totalOpportunities++;
          ensureAction(phaseStats.all, ev.action).totalOpportunities++;

          if (ev.target !== undefined) {
            totalTargetedActions++;
            totalPotentialBystanders += Math.max(0, aliveCount - 2);
          }

          if (!byAliveCount[aliveCount]) byAliveCount[aliveCount] = { target: 0, bystander: 0, opportunities: 0 };
          byAliveCount[aliveCount].opportunities++;
        }
      }

      if (ev.type === 'block') {
        isBlockChallenge = true; // next challenge is about the block, not the action
      }

      if (ev.type === 'challenge_success' || ev.type === 'challenge_fail') {
        if (!lastAction) continue;

        // Skip block challenges — we only care about action challenges
        if (isBlockChallenge) continue;

        const challengeable = ['tax', 'steal', 'assassinate', 'exchange'];
        if (!challengeable.includes(lastAction.action)) continue;

        const isTarget = lastAction.target !== undefined && ev.challenger === lastAction.target;
        const isSuccess = ev.type === 'challenge_success';
        const phase = turnNumber <= 5 ? 'early' : turnNumber <= 15 ? 'mid' : 'late';

        const statsPhase = ensureAction(phaseStats[phase], lastAction.action);
        const statsAll = ensureAction(phaseStats.all, lastAction.action);

        if (isTarget) {
          statsPhase.targetChallenges++;
          statsAll.targetChallenges++;
          if (isSuccess) { statsPhase.targetSuccesses++; statsAll.targetSuccesses++; }
          if (byAliveCount[aliveCount]) byAliveCount[aliveCount].target++;
        } else {
          statsPhase.bystanderChallenges++;
          statsAll.bystanderChallenges++;
          if (isSuccess) { statsPhase.bystanderSuccesses++; statsAll.bystanderSuccesses++; }
          if (byAliveCount[aliveCount]) byAliveCount[aliveCount].bystander++;
        }
      }
    }
  }

  // ─── Print Results ───

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CHALLENGE BEHAVIOR ANALYSIS — Target vs Bystander');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const [phaseName, map] of [
    ['ALL PHASES', phaseStats.all],
    ['EARLY (turns 1-5)', phaseStats.early],
    ['MID (turns 6-15)', phaseStats.mid],
    ['LATE (turns 16+)', phaseStats.late],
  ] as [string, ActionChallengeMap][]) {
    console.log(`  ── ${phaseName} ──\n`);
    console.log('  Action       │ Opportunities │ Target Chall │ Target %  │ Bystander Chall │ Bystander % │ T Success% │ B Success%');
    console.log('  ─────────────┼───────────────┼──────────────┼───────────┼─────────────────┼─────────────┼────────────┼───────────');

    const actions = ['steal', 'assassinate', 'tax', 'exchange'];
    let totOpp = 0, totTarget = 0, totBystander = 0, totTSucc = 0, totBSucc = 0;

    for (const action of actions) {
      const s = map[action] || emptyStats();
      totOpp += s.totalOpportunities;
      totTarget += s.targetChallenges;
      totBystander += s.bystanderChallenges;
      totTSucc += s.targetSuccesses;
      totBSucc += s.bystanderSuccesses;

      const tPct = s.totalOpportunities > 0 ? (s.targetChallenges / s.totalOpportunities * 100).toFixed(1) : '-';
      const bPct = s.totalOpportunities > 0 ? (s.bystanderChallenges / s.totalOpportunities * 100).toFixed(1) : '-';
      const tSuccPct = s.targetChallenges > 0 ? (s.targetSuccesses / s.targetChallenges * 100).toFixed(1) : '-';
      const bSuccPct = s.bystanderChallenges > 0 ? (s.bystanderSuccesses / s.bystanderChallenges * 100).toFixed(1) : '-';

      console.log(`  ${action.padEnd(13)}│ ${String(s.totalOpportunities).padStart(13)} │ ${String(s.targetChallenges).padStart(12)} │ ${String(tPct).padStart(8)}% │ ${String(s.bystanderChallenges).padStart(15)} │ ${String(bPct).padStart(10)}% │ ${String(tSuccPct).padStart(9)}% │ ${String(bSuccPct).padStart(9)}%`);
    }

    // Totals
    const totalTPct = totOpp > 0 ? (totTarget / totOpp * 100).toFixed(1) : '-';
    const totalBPct = totOpp > 0 ? (totBystander / totOpp * 100).toFixed(1) : '-';
    const totalTSuccPct = totTarget > 0 ? (totTSucc / totTarget * 100).toFixed(1) : '-';
    const totalBSuccPct = totBystander > 0 ? (totBSucc / totBystander * 100).toFixed(1) : '-';
    console.log('  ─────────────┼───────────────┼──────────────┼───────────┼─────────────────┼─────────────┼────────────┼───────────');
    console.log(`  ${'TOTAL'.padEnd(13)}│ ${String(totOpp).padStart(13)} │ ${String(totTarget).padStart(12)} │ ${String(totalTPct).padStart(8)}% │ ${String(totBystander).padStart(15)} │ ${String(totalBPct).padStart(10)}% │ ${String(totalTSuccPct).padStart(9)}% │ ${String(totalBSuccPct).padStart(9)}%`);

    // Target vs bystander ratio
    const total = totTarget + totBystander;
    if (total > 0) {
      console.log(`\n  Challenge source: ${(totTarget / total * 100).toFixed(1)}% from targets, ${(totBystander / total * 100).toFixed(1)}% from bystanders`);
    }
    console.log('');
  }

  // ─── By Alive Count ───
  console.log('  ── CHALLENGE RATE BY ALIVE PLAYER COUNT ──\n');
  console.log('  Alive │ Opportunities │ Target Chall │ Bystander Chall │ Target %  │ Bystander % │ B per-player %');
  console.log('  ──────┼───────────────┼──────────────┼─────────────────┼───────────┼─────────────┼───────────────');

  for (const count of [5, 4, 3, 2]) {
    const s = byAliveCount[count];
    if (!s) continue;
    const tPct = s.opportunities > 0 ? (s.target / s.opportunities * 100).toFixed(1) : '-';
    const bPct = s.opportunities > 0 ? (s.bystander / s.opportunities * 100).toFixed(1) : '-';
    // Per-player bystander rate: bystander challenges / (opportunities * (count-2))
    // because there are (count-2) potential bystanders per targeted action
    const potentialBystanders = count - 2;
    const perPlayerBPct = (s.opportunities > 0 && potentialBystanders > 0)
      ? (s.bystander / (s.opportunities * potentialBystanders) * 100).toFixed(2)
      : '-';
    console.log(`  ${String(count).padStart(5)} │ ${String(s.opportunities).padStart(13)} │ ${String(s.target).padStart(12)} │ ${String(s.bystander).padStart(15)} │ ${String(tPct).padStart(8)}% │ ${String(bPct).padStart(10)}% │ ${String(perPlayerBPct).padStart(13)}%`);
  }

  console.log(`\n  Total targeted actions: ${totalTargetedActions}`);
  console.log(`  Total potential bystander opportunities: ${totalPotentialBystanders}`);
  console.log(`  Human-only games: ${humanOnlyGames} / ${games.length}`);

  // ─── Untargeted action challenge rates ───
  console.log('\n  ── UNTARGETED ACTION CHALLENGES (Tax, Exchange) ──');
  console.log('  These have no "target" — all challengers are bystanders\n');

  for (const action of ['tax', 'exchange']) {
    const s = phaseStats.all[action] || emptyStats();
    const totalChall = s.targetChallenges + s.bystanderChallenges;
    const challPct = s.totalOpportunities > 0 ? (totalChall / s.totalOpportunities * 100).toFixed(1) : '-';
    const perPlayerPct = s.totalOpportunities > 0 ? (totalChall / (s.totalOpportunities * 4) * 100).toFixed(2) : '-'; // 4 potential challengers in 5p
    console.log(`  ${action}: ${totalChall} challenges / ${s.totalOpportunities} opportunities = ${challPct}% (per-player: ~${perPlayerPct}%)`);
  }
}

main();
