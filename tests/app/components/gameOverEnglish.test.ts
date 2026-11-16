/**
 * The game-over text moved from English built in code to `gameover` catalog
 * messages (docs/I18N.md). This file keeps the old English code as a
 * reference and checks, on real bot games in every mode and from every seat
 * (and a spectator's), that the English catalog reproduces it exactly: the
 * line under the title, "How it went", the awards, the bluff table and the
 * copied recap. It also checks that stats and awards read the log's
 * structured fields and never its English text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { BotBrain, type BotDecision } from '@/engine/BotBrain';
import { BOT_PERSONALITIES } from '@/shared/constants';
import { Character, ClientGameState, ClientPlayerState, GameMode, GameStatus, LogEntry } from '@/shared/types';
import { serializeForPlayer } from '@/server/StateSerializer';
import { makePlainTranslator } from '@/app/i18n/runtime';
import { computeAwards, computeBluffSummary, computePlayerStats, type PlayerStats } from '@/app/utils/gameStats';
import {
  awardLine,
  bluffLine,
  bluffRowText,
  challengeLine,
  finishOrLength,
  loserLine,
  readerOf,
  recapPlain,
  winnerLine,
} from '@/app/components/game/gameover/summary';
import { buildRecapExport } from '@/app/components/game/gameover/recapExport';

const t = makePlainTranslator('en');

// ─── The English code this replaced, kept verbatim as the reference ───

namespace Legacy {
  function nameOf(state: ClientGameState, id: string | null | undefined): string {
    if (!id) return 'Someone';
    if (id === state.myId) return 'You';
    return state.players.find(p => p.id === id)?.name ?? 'Someone';
  }
  function objectNameOf(state: ClientGameState, id: string | null | undefined): string {
    const name = nameOf(state, id);
    return name === 'You' ? 'you' : name;
  }
  const FINISHING_CAUSES = new Set<LogEntry['eventType']>(['coup', 'assassination', 'challenge_success', 'challenge_fail', 'block_challenge_success', 'block_challenge_fail']);

  export function finishLine(state: ClientGameState): string | null {
    const log = state.actionLog;
    let lastOut = -1;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].eventType === 'elimination') { lastOut = i; break; }
    }
    if (lastOut < 0) return null;
    const out = log[lastOut];
    const turn = out.turnNumber;
    const loser = objectNameOf(state, out.actorId);
    for (let i = lastOut - 1; i >= 0; i--) {
      const entry = log[i];
      if (entry.turnNumber !== turn || entry.eventType === 'turn_start') break;
      if (!FINISHING_CAUSES.has(entry.eventType)) continue;
      const actor = nameOf(state, entry.actorId);
      switch (entry.eventType) {
        case 'coup': return `${actor} ended it on turn ${turn} with a Coup on ${loser}.`;
        case 'assassination': return `${actor} ended it on turn ${turn} by assassinating ${loser}.`;
        case 'challenge_success': return `${actor} ended it on turn ${turn} by catching ${loser} bluffing.`;
        case 'block_challenge_success': return `${actor} ended it on turn ${turn} by catching ${loser} bluffing a block.`;
        case 'challenge_fail':
          return entry.character
            ? `${actor} ended it on turn ${turn}: ${loser} challenged and ${actor === 'You' ? 'you' : actor} had the ${entry.character}.`
            : `${actor} ended it on turn ${turn} when ${loser} lost a challenge.`;
        case 'block_challenge_fail':
          return entry.character
            ? `${actor} ended it on turn ${turn}: ${loser} challenged the block and ${actor === 'You' ? 'you' : actor} had the ${entry.character}.`
            : `${actor} ended it on turn ${turn} when ${loser} lost a challenge.`;
      }
    }
    const who = nameOf(state, out.actorId);
    return `${who} lost ${who === 'You' ? 'your' : 'their'} last card on turn ${turn}.`;
  }

  function statsFor(state: ClientGameState): PlayerStats[] {
    const names = new Map(state.players.map(p => [p.id, nameOf(state, p.id)] as const));
    return Array.from(computePlayerStats(state.actionLog, state.players.map(p => p.id), names).values());
  }
  function times(n: number): string {
    return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
  }
  function soleLeader(all: PlayerStats[], score: (s: PlayerStats) => number): PlayerStats | null {
    const sorted = [...all].sort((a, b) => score(b) - score(a));
    if (!sorted[0] || score(sorted[0]) === 0) return null;
    if (sorted[1] && score(sorted[1]) === score(sorted[0])) return null;
    return sorted[0];
  }
  export function bluffLine(state: ClientGameState): string | null {
    const all = statsFor(state);
    const claims = all.reduce((sum, s) => sum + s.actionsClaimed + s.blocksMade, 0);
    if (claims === 0) return null;
    const bluffs = all.reduce((sum, s) => sum + s.actualBluffs, 0);
    if (bluffs === 0) return claims === 1 ? 'The one claim was honest.' : `All ${claims} claims were honest.`;
    const caught = all.reduce((sum, s) => sum + s.timesCaughtBluffing, 0);
    const lead = bluffs === 1 ? `1 of ${claims} claims was a bluff.` : `${bluffs} of ${claims} claims were bluffs.`;
    let caughtText: string;
    if (bluffs === 1) caughtText = caught > 0 ? 'It was caught.' : 'It got away.';
    else if (caught === 0) caughtText = 'None were caught.';
    else if (caught >= bluffs) caughtText = 'All were caught.';
    else caughtText = `${caught} ${caught === 1 ? 'was' : 'were'} caught.`;
    const top = soleLeader(all, s => s.actualBluffs);
    const who = top && top.actualBluffs > 1 ? ` ${top.playerName} bluffed the most, ${times(top.actualBluffs)}.` : '';
    return `${lead} ${caughtText}${who}`;
  }
  export function challengeLine(state: ClientGameState): string | null {
    const all = statsFor(state);
    const made = all.reduce((sum, s) => sum + s.challengesMade, 0);
    if (made === 0) return null;
    const won = all.reduce((sum, s) => sum + s.challengesWon, 0);
    if (made === 1) {
      const winner = all.find(s => s.challengesWon > 0);
      return winner ? `${winner.playerName} made the only challenge and won it.` : 'The only challenge failed.';
    }
    if (won === 0) return `All ${made} challenges failed.`;
    const lead = `Challengers won ${won} of ${made} challenges.`;
    const best = soleLeader(all, s => s.challengesWon);
    if (!best || won === 1) return lead;
    return `${lead} ${best.playerName} won ${best.challengesWon === won ? 'all of them' : best.challengesWon}.`;
  }

  function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
  }
  function ordinal(n: number): string {
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
    return `${n}${suffix}`;
  }
  function flavorStats(state: ClientGameState) {
    return computePlayerStats(state.actionLog, state.players.map(p => p.id), new Map(state.players.map(p => [p.id, p.name])));
  }
  export function winnerFlavor(gameState: ClientGameState): string {
    const winnerId = gameState.winnerId;
    if (!winnerId) return 'Everyone else is out.';
    const w = flavorStats(gameState).get(winnerId);
    if (!w) return 'Everyone else is out.';
    if (w.actionsClaimed === 0) return 'You won without claiming a character on your turn.';
    if (w.timesCaughtBluffing >= 2) return `You were caught bluffing ${w.timesCaughtBluffing} times and still won.`;
    if (w.timesCaughtBluffing === 1) return 'You were caught bluffing once and still won.';
    if (w.challengesWon >= 2) return `You won ${w.challengesWon} challenges.`;
    if (w.timesProvenHonest >= 2) return `You were challenged ${w.timesProvenHonest} times and had the card every time.`;
    if (w.assassinationsMade >= 2) return `You won with ${w.assassinationsMade} assassinations.`;
    if (w.coupsMade >= 2) return `You won with ${w.coupsMade} Coups.`;
    if (w.blocksMade >= 2) return `You blocked ${w.blocksMade} actions.`;
    if (w.actionsClaimed >= 3 && w.timesCaughtBluffing === 0) return `You made ${w.actionsClaimed} claims and were never caught.`;
    return 'Everyone else is out.';
  }
  export function loserFlavor(gameState: ClientGameState): string {
    const myId = gameState.myId;
    if (!myId) return 'Thanks for watching.';
    const m = flavorStats(gameState).get(myId);
    if (!m) return 'Thanks for watching.';
    if (m.eliminationOrder === 1) return 'You were the first player out.';
    if (m.timesCaughtBluffing >= 2) return `You were caught bluffing ${m.timesCaughtBluffing} times.`;
    if (m.timesCaughtBluffing === 1) return 'You were caught bluffing once.';
    if (m.challengesLost >= 2) return `You lost ${m.challengesLost} challenges.`;
    if (m.actionsClaimed === 0) return 'You never claimed a character on your turn.';
    if (m.challengesWon >= 2) return `You won ${m.challengesWon} challenges.`;
    if (m.blocksMade >= 2) return `You blocked ${m.blocksMade} actions.`;
    if (m.assassinationsMade >= 1 || m.coupsMade >= 1) {
      const hits: string[] = [];
      if (m.coupsMade >= 1) hits.push(plural(m.coupsMade, 'Coup'));
      if (m.assassinationsMade >= 1) hits.push(plural(m.assassinationsMade, 'assassination'));
      return `You landed ${hits.join(' and ')}.`;
    }
    if (m.eliminationOrder > 1) return `You were the ${ordinal(m.eliminationOrder)} player out.`;
    return "You're out.";
  }

  const AWARD_TEXT: Record<string, [string, (p: Record<string, number>) => string]> = {
    pantsOnFire: ['Pants on Fire', p => `caught bluffing ${p.count}x`],
    honestAbe: ['Honest Abe', p => `proven honest ${p.count}x, never caught`],
    inquisitor: ['The Inquisitor', p => `${p.count} challenges made`],
    eagleEye: ['Eagle Eye', p => `${p.won}/${p.made} challenges correct`],
    wall: ['The Wall', p => `${p.count} blocks made`],
    smoothOperator: ['Smooth Operator', p => `${p.count} claims, never caught`],
    coupMachine: ['Coup Machine', p => `${p.count} Coups launched`],
    silentAssassin: ['Silent Assassin', p => (p.count === 1 ? '1 assassination' : `${p.count} assassinations`)],
    boldStrategy: ['Bold Strategy', p => `${p.count} challenges lost`],
    quickExit: ['Quick Exit', () => 'first player eliminated'],
  };
  /** Title, then "Name, description" with the reader as "You". */
  export function award(state: ClientGameState, id: string, playerId: string, params: Record<string, number>): string {
    const [title, describe] = AWARD_TEXT[id];
    return `${title}|${nameOf(state, playerId)}, ${describe(params)}`;
  }

  export function bluffRow(state: ClientGameState, e: ReturnType<typeof computeBluffSummary>[number]): string {
    const name = e.playerId === state.myId ? 'You' : state.players.find(p => p.id === e.playerId)!.name;
    const claims = plural(e.totalClaims, 'claim');
    if (e.bluffs === 0) return `${name}|${claims}, all honest`;
    const parts = [claims, plural(e.bluffs, 'bluff')];
    if (e.caughtBluffing > 0) parts.push(`${e.caughtBluffing} caught`);
    if (e.unchallengedBluffs > 0) parts.push(`${e.unchallengedBluffs} got away`);
    return `${name}|${parts.join(' · ')}`;
  }

  export function replayExport(gameState: ClientGameState): string {
    const winner = gameState.players.find(p => p.id === gameState.winnerId);
    return [
      `Coup Online recap, room ${gameState.roomCode}`,
      `Winner: ${winner?.name ?? 'Unknown'}`,
      `Turns: ${gameState.turnNumber}`,
      `Mode: ${gameState.gameMode}${gameState.useInquisitor ? ' with Inquisitor' : ''}`,
      '',
      'Final table:',
      ...gameState.players.map(player => {
        const cards = player.influences
          .map(inf => (inf.character ? `${inf.character} ${inf.revealed ? 'revealed' : 'hidden'}` : 'hidden card'))
          .join(', ');
        const status = player.id === gameState.winnerId ? 'winner' : player.isAlive ? 'alive' : 'eliminated';
        const faction = player.faction ? `, ${player.faction}` : '';
        return `- ${player.name}: ${status}, ${player.coins} coin${player.coins === 1 ? '' : 's'}${faction}, ${cards}`;
      }),
      '',
      'Final log:',
      ...gameState.actionLog.map(entry => `[T${String(entry.turnNumber).padStart(2, '0')}] ${entry.message}`),
    ].join('\n');
  }
}

// ─── Real games ───

function act(engine: GameEngine, id: string, d: BotDecision): string | null {
  switch (d.type) {
    case 'action': return engine.handleAction(id, d.action, d.targetId);
    case 'challenge': return engine.handleChallenge(id);
    case 'pass_challenge': return engine.handlePassChallenge(id);
    case 'block': return engine.handleBlock(id, d.character);
    case 'pass_block': return engine.handlePassBlock(id);
    case 'challenge_block': return engine.handleChallengeBlock(id);
    case 'pass_challenge_block': return engine.handlePassChallengeBlock(id);
    case 'choose_influence_loss': return engine.handleChooseInfluenceLoss(id, d.influenceIndex);
    case 'choose_exchange': return engine.handleChooseExchange(id, d.keepIndices);
    case 'choose_examine_influence': return engine.handleChooseExamineInfluence(id, d.influenceIndex);
    case 'examine_decision': return engine.handleExamineDecision(id, d.forceSwap);
    case 'convert': return engine.handleConvert(id, d.targetId);
    default: return 'unknown';
  }
}

const NAMES = ['Ana', "D'Arcy", 'Bùi Văn', 'Seraphina Delacroix', 'محمد', 'Zoë'];
const PERSONALITIES = ['aggressive', 'deceptive', 'analytical', 'optimal', 'conservative', 'vengeful'] as const;

function playGame(players: number, mode: GameMode, useInquisitor: boolean, seed: number): ClientGameState {
  const engine = new GameEngine(`G${seed}`, 0, 0);
  const infos = Array.from({ length: players }, (_, i) => ({ id: `p${i}-${seed}`, name: NAMES[i] }));
  engine.startGame(infos, mode === GameMode.Reformation ? { gameMode: mode, useInquisitor } : undefined);
  const memory = new Map(infos.map(p => [p.id, new Map<Character, number>()]));
  for (let steps = 0; steps < 4000 && engine.game.status === GameStatus.InProgress; steps++) {
    let acted = false;
    for (const [i, p] of infos.entries()) {
      const s = engine.getFullState();
      const d = BotBrain.decide(engine.game, p.id, BOT_PERSONALITIES[PERSONALITIES[(i + seed) % PERSONALITIES.length]],
        s.pendingAction, s.pendingBlock, s.challengeState, s.influenceLossRequest, s.exchangeState,
        s.blockPassedPlayerIds, memory.get(p.id)!, s.examineState ?? undefined, s.examineSelectionState ?? undefined);
      if (d && !act(engine, p.id, d)) { acted = true; break; }
    }
    if (!acted) engine.handleTimerExpiry();
  }
  const state = serializeForPlayer(engine.getFullState(), infos[0].id);
  engine.destroy();
  return state;
}

function playMany(): ClientGameState[] {
  const games: ClientGameState[] = [];
  let seed = 0;
  const configs: [number, GameMode, boolean][] = [
    [2, GameMode.Classic, false], [3, GameMode.Classic, false], [4, GameMode.Classic, false],
    [5, GameMode.Classic, false], [6, GameMode.Classic, false],
    [4, GameMode.Reformation, false], [6, GameMode.Reformation, false], [5, GameMode.Reformation, true],
  ];
  for (const [n, mode, inq] of configs) {
    for (let k = 0; k < 4; k++) games.push(playGame(n, mode, inq, seed++));
  }
  return games;
}

/** Every seat's view, plus a spectator's (an id that matches no player). */
function views(state: ClientGameState): ClientGameState[] {
  return [...state.players.map(p => p.id), 'spectator'].map(myId => ({ ...state, myId }));
}

describe('the English catalog reproduces the old game-over text', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('on real games, from every seat', () => {
    const games = playMany();
    let checked = 0;
    for (const game of games) {
      expect(game.status).toBe(GameStatus.Finished);
      expect(buildRecapExport(game, t)).toBe(Legacy.replayExport(game));
      for (const s of views(game)) {
        const reader = readerOf(s);
        const text = (m: Parameters<typeof recapPlain>[0] | null) => (m ? recapPlain(m, t, reader) : null);
        expect(text(finishOrLength(s))).toBe(Legacy.finishLine(s) ?? `The game lasted ${s.turnNumber} turns.`);
        expect(text(bluffLine(s))).toBe(Legacy.bluffLine(s));
        expect(text(challengeLine(s))).toBe(Legacy.challengeLine(s));
        expect(text(winnerLine(s))).toBe(Legacy.winnerFlavor(s));
        expect(text(loserLine(s))).toBe(Legacy.loserFlavor(s));
        expect(computeAwards(s).map(a => `${t(`gameover.awardTitle.${a.id}`)}|${text(awardLine(a))}`))
          .toEqual(computeAwards(s).map(a => Legacy.award(s, a.id, a.playerId, a.params)));
        expect(computeBluffSummary(s).map(e => `${e.playerId === s.myId ? t('gameover.youName') : reader.names.get(e.playerId)}|${bluffRowText(e, t)}`))
          .toEqual(computeBluffSummary(s).map(e => Legacy.bluffRow(s, e)));
        checked++;
      }
    }
    console.info(`checked ${checked} views of ${games.length} games, ${games.reduce((n, g) => n + g.actionLog.length, 0)} log lines`);
    expect(checked).toBeGreaterThan(100);
  });

  it('on hand-built logs that reach the rarer lines', () => {
    const template = playGame(2, GameMode.Classic, false, 99);
    const players: ClientPlayerState[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, seatIndex) => ({
      id, name: id.toUpperCase(), coins: 2, influences: [], isAlive: id === 'a', seatIndex,
    }));
    const e = (eventType: LogEntry['eventType'], actorId: string, extra: Partial<LogEntry> = {}): LogEntry =>
      ({ message: '', timestamp: 0, character: null, turnNumber: 9, actorId, actorName: null, eventType, ...extra });
    const base = (actionLog: LogEntry[], myId: string): ClientGameState => ({
      ...template, players, winnerId: 'a', myId, actionLog, turnNumber: 9,
    });
    const logs: LogEntry[][] = [
      // Out 2nd..5th, with nothing else to say.
      ['b', 'c', 'd', 'e', 'f'].map(id => e('elimination', id)),
      // A block caught, then a block that held, with and without a character.
      [e('block', 'b', { wasBluff: true }), e('block_challenge', 'a'), e('block_challenge_success', 'a'), e('elimination', 'b')],
      [e('block', 'a'), e('block_challenge', 'b'), e('block_challenge_fail', 'a', { character: Character.Contessa }), e('elimination', 'b')],
      [e('claim_action', 'a'), e('challenge', 'c'), e('challenge_fail', 'a'), e('elimination', 'c')],
      // One honest claim; one bluff that got away; one challenge won.
      [e('claim_action', 'b'), e('elimination', 'b')],
      [e('claim_action', 'b', { wasBluff: true }), e('challenge', 'a'), e('challenge_success', 'a'), e('claim_action', 'c', { wasBluff: true }), e('elimination', 'b')],
      // Two bluffs by the same player, both caught; challengers won some.
      [e('claim_action', 'b', { wasBluff: true }), e('challenge', 'a'), e('challenge_success', 'a'), e('claim_action', 'b', { wasBluff: true }), e('challenge', 'c'), e('challenge_success', 'c'), e('claim_action', 'd'), e('challenge', 'a'), e('challenge_fail', 'd'), e('elimination', 'b')],
      // Blocks, coups and assassinations by the winner.
      [e('block', 'a'), e('block', 'a'), e('coup', 'a'), e('coup', 'a'), e('elimination', 'b')],
      [e('claim_action', 'a'), e('assassination', 'a'), e('claim_action', 'a'), e('assassination', 'a'), e('elimination', 'b')],
      [e('claim_action', 'a'), e('challenge', 'b'), e('challenge_fail', 'a'), e('claim_action', 'a'), e('challenge', 'c'), e('challenge_fail', 'a'), e('elimination', 'c')],
    ];
    for (const log of logs) {
      for (const myId of ['a', 'b', 'c', 'd', 'e', 'f', 'z']) {
        const s = base(log, myId);
        const reader = readerOf(s);
        const text = (m: Parameters<typeof recapPlain>[0] | null) => (m ? recapPlain(m, t, reader) : null);
        expect(text(finishOrLength(s))).toBe(Legacy.finishLine(s));
        expect(text(bluffLine(s))).toBe(Legacy.bluffLine(s));
        expect(text(challengeLine(s))).toBe(Legacy.challengeLine(s));
        expect(text(winnerLine(s))).toBe(Legacy.winnerFlavor(s));
        expect(text(loserLine(s))).toBe(Legacy.loserFlavor(s));
      }
    }
  });
});

describe('stats and awards read structured fields, never the English text', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('give the same results with every log message blanked', () => {
    for (const game of playMany().slice(0, 16)) {
      const blank = { ...game, actionLog: game.actionLog.map(entry => ({ ...entry, message: '' })) };
      for (const [a, b] of views(game).map((s, i) => [s, views(blank)[i]] as const)) {
        expect(computeAwards(b)).toEqual(computeAwards(a));
        expect(computeBluffSummary(b)).toEqual(computeBluffSummary(a));
        expect(computePlayerStats(b.actionLog, b.players.map(p => p.id))).toEqual(computePlayerStats(a.actionLog, a.players.map(p => p.id)));
        expect(recapPlain(finishOrLength(b), t, readerOf(b))).toBe(recapPlain(finishOrLength(a), t, readerOf(a)));
      }
      // The recap's log comes from each entry's structured `msg`, so it is unchanged too.
      expect(buildRecapExport(blank, t)).toBe(buildRecapExport(game, t));
    }
  });
});
