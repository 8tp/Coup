import { writeFileSync } from 'fs';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { BotController } from '@/server/BotController';
import { serializeForPlayer, serializeForSpectator } from '@/server/StateSerializer';
import { ACTION_DEFINITIONS, CARDS_PER_CHARACTER, TOTAL_COINS } from '@/shared/constants';
import {
  ActionType,
  BotPersonality,
  Character,
  GameMode,
  GameState,
  GameStatus,
  RoomPlayer,
  TurnPhase,
} from '@/shared/types';

/**
 * Soak: whole games through the real GameEngine + BotController, with bots
 * only and with scripted humans who pass, challenge, block (early and late),
 * bluff, send stale or doubled answers, time out at random and sometimes leave
 * mid-game (their seat handed to a bot, as RoomManager.replaceWithBot does).
 *
 * After every broadcast it checks the invariants a real table depends on:
 * coins and cards conserved, the turn passing to the next live seat, nobody
 * dead holding a decision, no hidden card in any player's or spectator's view,
 * and at the end exactly one winner and silence afterwards.
 *
 * SOAK_GAMES=<n> runs more games (default keeps the suite fast); SOAK_OUT=<file>
 * writes a summary.
 */

const GAMES = Number(process.env.SOAK_GAMES || 120);
const PERSONALITIES: BotPersonality[] = ['aggressive', 'conservative', 'vengeful', 'deceptive', 'analytical', 'optimal', 'random'];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(xs: T[]): T => xs[rand(xs.length)];
const chance = (p: number) => Math.random() < p;

interface Config {
  mode: GameMode;
  useInquisitor: boolean;
  seats: number;
  humans: number;
  timerMs: number;
  turnTimerMs: number;
  botMinReactionMs: number;
}

interface Outcome {
  ok: boolean;
  problems: string[];
  turns: number;
  botErrors: Map<string, number>;
  humanErrors: number;
  earlyBlocks: number;
  timeouts: number;
  replaced: number;
}

function humanKey(s: GameState, me: string): string {
  return [
    s.turnNumber, s.turnPhase, s.pendingAction?.type ?? '', s.pendingBlock?.blockerId ?? '',
    s.influenceLossRequest?.playerId ?? '', s.influenceLossRequest?.reason ?? '',
    s.challengeState?.passedPlayerIds.includes(me) ? 'p' : '',
    s.blockPassedPlayerIds.includes(me) ? 'bp' : '',
    s.pendingAction?.declaredBlock?.blockerId ?? '',
  ].join('|');
}

function runGame(cfg: Config): Outcome {
  const problems: string[] = [];
  const botErrors = new Map<string, number>();
  let humanErrors = 0;
  let earlyBlocks = 0;
  let timeouts = 0;
  let replaced = 0;

  const engine = new GameEngine('SOAK', cfg.timerMs, cfg.turnTimerMs);
  const ids = Array.from({ length: cfg.seats }, (_, i) => (i < cfg.humans ? `h${i}` : `b${i}`));
  const humans = new Set(ids.filter(id => id.startsWith('h')));
  const replacedAt = new Map<string, number>();
  const botPlayers: RoomPlayer[] = ids.filter(id => id.startsWith('b')).map(id => ({
    id, name: id, socketId: '', connected: true, isBot: true, personality: pick(PERSONALITIES),
  }));

  engine.setOnPlayerTimeout((pid, phase) => {
    timeouts++;
    // A seat handed over moments before its timer ran out can time out once; anything else is a stall.
    const justReplaced = replacedAt.has(pid) && Date.now() - replacedAt.get(pid)! <= 5_000;
    if (!humans.has(pid) && !justReplaced) { const k = `${pid.startsWith('h') ? 'seat handed to a bot' : 'bot'} timed out in ${phase}`; botErrors.set(k, (botErrors.get(k) ?? 0) + 1); }
  });

  // Wrap every engine entry point: record who acted, and whether they were alive.
  const wrap = (name: keyof GameEngine) => {
    const orig = (engine[name] as unknown as (...a: unknown[]) => string | null).bind(engine);
    (engine as unknown as Record<string, unknown>)[name] = (playerId: string, ...rest: unknown[]) => {
      const before = engine.game.getPlayer(playerId);
      const wasAlive = before?.isAlive ?? false;
      const phase = engine.game.turnPhase;
      const err = orig(playerId, ...rest);
      if (err === null && !wasAlive) problems.push(`${String(name)} by dead ${playerId} accepted in ${phase}`);
      if (err === null && phase === TurnPhase.GameOver) problems.push(`${String(name)} accepted after GameOver`);
      if (err !== null) {
        if (humans.has(playerId)) humanErrors++;
        else {
          const k = `${String(name)}: ${err}`;
          botErrors.set(k, (botErrors.get(k) ?? 0) + 1);
        }
      }
      return err;
    };
  };
  for (const n of ['handleAction', 'handleChallenge', 'handlePassChallenge', 'handleBlock', 'handlePassBlock',
    'handleChallengeBlock', 'handlePassChallengeBlock', 'handleChooseInfluenceLoss', 'handleChooseExchange',
    'handleExamineDecision', 'handleChooseExamineInfluence', 'handleConvert', 'handleEmbezzle'] as const) {
    wrap(n);
  }

  const controller = new BotController(engine, botPlayers, cfg.botMinReactionMs);
  const humanTimers = new Map<string, { key: string; t: ReturnType<typeof setTimeout> | null }>();

  let prevTurn = 0;
  let prevIndex = -1;
  let broadcastsAfterOver = 0;
  let over = false;
  const initialCards = new Map<Character, number>();

  const check = (s: GameState) => {
    if (over) { broadcastsAfterOver++; return; }
    const g = engine.game;
    // Coins
    const coins = g.players.reduce((a, p) => a + p.coins, 0) + g.treasury + g.treasuryReserve;
    if (coins !== TOTAL_COINS) problems.push(`coins ${coins} != ${TOTAL_COINS} at turn ${s.turnNumber} ${s.turnPhase}`);
    if (g.players.some(p => p.coins < 0) || g.treasury < 0 || g.treasuryReserve < 0) problems.push('negative coins');
    // Cards
    const counts = new Map<Character, number>();
    for (const p of g.players) for (const inf of p.influences) counts.set(inf.character, (counts.get(inf.character) ?? 0) + 1);
    for (const c of g.deck.getCards()) counts.set(c, (counts.get(c) ?? 0) + 1);
    // Cards drawn for an exchange are in the exchanger's hand of options until chosen
    for (const c of s.exchangeState?.drawnCards ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
    if (initialCards.size === 0) for (const [k, v] of counts) initialCards.set(k, v);
    for (const [k, v] of initialCards) if ((counts.get(k) ?? 0) !== v) problems.push(`card ${k} ${counts.get(k)} != ${v} at turn ${s.turnNumber} ${s.turnPhase}`);
    if (counts.size !== initialCards.size) problems.push('card kinds changed');
    // Hand sizes never change
    if (g.players.some(p => p.influences.length !== 2)) problems.push('hand size changed');

    if (s.turnPhase === TurnPhase.GameOver) {
      const alive = g.getAlivePlayers();
      if (alive.length !== 1) problems.push(`game over with ${alive.length} alive`);
      if (s.winnerId !== alive[0]?.id) problems.push('winner is not the last player standing');
      if (s.status !== GameStatus.Finished) problems.push('game over but not finished');
      if (g.actionLog.filter(e => e.eventType === 'win').length !== 1) problems.push('win logged != 1 time');
      over = true;
    } else {
      if (s.status !== GameStatus.InProgress) problems.push(`status ${s.status} in ${s.turnPhase}`);
      if (g.getAlivePlayers().length < 2) problems.push('fewer than two alive but not game over');
      if (!g.currentPlayer.isAlive) problems.push(`dead current player in ${s.turnPhase}`);
      if (s.influenceLossRequest && !g.getPlayer(s.influenceLossRequest.playerId)?.isAlive) problems.push('dead player asked to lose influence');
      if (s.exchangeState && !g.getPlayer(s.exchangeState.playerId)?.isAlive) problems.push('dead player exchanging');
      if (s.timerExpiry === null && cfg.turnTimerMs > 0) problems.push(`no timer running in ${s.turnPhase}`);
      if (s.pendingAction && s.turnPhase !== TurnPhase.AwaitingInfluenceLoss && !g.getPlayer(s.pendingAction.actorId)?.isAlive
        && s.turnPhase !== TurnPhase.AwaitingBlockChallenge) {
        problems.push(`dead actor's action pending in ${s.turnPhase}`);
      }
    }

    // Turn order: a new turn goes to the next live seat after the last one.
    if (s.turnNumber !== prevTurn) {
      if (prevTurn !== 0) {
        if (s.turnNumber !== prevTurn + 1) problems.push(`turn jumped ${prevTurn} -> ${s.turnNumber}`);
        let next = (prevIndex + 1) % g.players.length;
        while (!g.players[next].isAlive) next = (next + 1) % g.players.length;
        if (s.turnPhase !== TurnPhase.GameOver && next !== s.currentPlayerIndex) {
          problems.push(`turn ${s.turnNumber} went to seat ${s.currentPlayerIndex}, expected ${next}`);
        }
      }
      prevTurn = s.turnNumber;
      prevIndex = s.currentPlayerIndex;
    }

    // Hidden information in every view
    const isOver = s.turnPhase === TurnPhase.GameOver;
    const views = [
      ...ids.map(id => ({ viewer: id, v: serializeForPlayer(s, id) })),
      { viewer: '__spec__', v: serializeForSpectator(s, 'spec') },
    ];
    for (const { viewer, v } of views) {
      const raw = v as unknown as Record<string, unknown>;
      if ('deck' in raw) problems.push('deck sent to client');
      for (const p of v.players) {
        p.influences.forEach((inf, i) => {
          const truth = g.getPlayer(p.id)!.influences[i];
          if (p.id !== viewer && !inf.revealed && inf.character !== null && !isOver) problems.push(`${viewer} sees ${p.id}'s hidden card`);
          if ((p.id === viewer || inf.revealed || isOver) && inf.character !== truth.character) problems.push('view card mismatch');
        });
      }
      if (v.exchangeState && s.exchangeState?.playerId !== viewer) problems.push(`${viewer} sees someone else's exchange`);
      if (v.examineState && s.examineState?.examinerId !== viewer) problems.push(`${viewer} sees someone else's examine`);
      if (!isOver && v.actionLog.some(e => 'wasBluff' in e)) problems.push('wasBluff sent before game over');
    }
  };

  const humanAct = (id: string) => {
    const s = engine.getFullState();
    const g = engine.game;
    const me = g.getPlayer(id);
    if (!me || !me.isAlive || !humans.has(id)) return;
    const alive = g.getAlivePlayers().filter(p => p.id !== id);
    const pa = s.pendingAction;
    const send = (fn: () => void) => { fn(); if (chance(0.05)) fn(); }; // occasional double tap
    // Occasional stale/out-of-phase command
    if (chance(0.03)) {
      pick([
        () => engine.handlePassChallenge(id), () => engine.handleChallenge(id), () => engine.handlePassBlock(id),
        () => engine.handleChallengeBlock(id), () => engine.handleBlock(id, pick(Object.values(Character))),
        () => engine.handleChooseInfluenceLoss(id, rand(2)), () => engine.handleAction(id, ActionType.Income),
      ])();
      return;
    }
    switch (s.turnPhase) {
      case TurnPhase.AwaitingAction: {
        if (g.currentPlayer.id !== id) return;
        const target = pick(alive);
        const options: Array<() => void> = [];
        if (me.coins >= 10) { options.push(() => engine.handleAction(id, ActionType.Coup, target.id)); }
        else {
          options.push(() => engine.handleAction(id, ActionType.Income));
          options.push(() => engine.handleAction(id, ActionType.ForeignAid));
          options.push(() => engine.handleAction(id, ActionType.Tax));
          options.push(() => engine.handleAction(id, ActionType.Steal, target.id));
          options.push(() => engine.handleAction(id, ActionType.Steal, target.id));
          options.push(() => engine.handleAction(id, ActionType.Exchange));
          if (me.coins >= 3) { options.push(() => engine.handleAction(id, ActionType.Assassinate, target.id)); options.push(() => engine.handleAction(id, ActionType.Assassinate, target.id)); }
          if (me.coins >= 7) options.push(() => engine.handleAction(id, ActionType.Coup, target.id));
          if (cfg.mode === GameMode.Reformation) {
            options.push(() => engine.handleConvert(id, chance(0.5) ? undefined : target.id));
            options.push(() => engine.handleEmbezzle(id));
            if (cfg.useInquisitor) options.push(() => engine.handleAction(id, ActionType.Examine, target.id));
          }
        }
        send(pick(options));
        return;
      }
      case TurnPhase.AwaitingActionChallenge: {
        if (!pa || pa.actorId === id) return;
        const passed = s.challengeState!.passedPlayerIds.includes(id);
        const def = ACTION_DEFINITIONS[pa.type];
        const canEarlyBlock = pa.targetId === id && def.blockedBy.length > 0 && !pa.declaredBlock;
        if (passed) {
          // A target who passed may still block in this window
          if (canEarlyBlock && chance(0.5)) { earlyBlocks++; send(() => engine.handleBlock(id, pick(def.blockedBy))); }
          return;
        }
        const r = Math.random();
        if (canEarlyBlock && r < 0.4) { earlyBlocks++; send(() => engine.handleBlock(id, pick(def.blockedBy))); }
        else if (r < 0.65) send(() => engine.handlePassChallenge(id));
        else send(() => engine.handleChallenge(id));
        return;
      }
      case TurnPhase.AwaitingBlock: {
        if (!pa || pa.actorId === id || s.blockPassedPlayerIds.includes(id)) return;
        const def = ACTION_DEFINITIONS[pa.type];
        const eligible = pa.type === ActionType.ForeignAid ? !g.isFactionRestricted(id, pa.actorId) : pa.targetId === id;
        if (!eligible) return;
        if (chance(0.5)) send(() => engine.handleBlock(id, pick(def.blockedBy)));
        else send(() => engine.handlePassBlock(id));
        return;
      }
      case TurnPhase.AwaitingBlockChallenge: {
        if (!s.pendingBlock || s.pendingBlock.blockerId === id || s.challengeState!.passedPlayerIds.includes(id)) return;
        if (chance(0.35)) send(() => engine.handleChallengeBlock(id));
        else send(() => engine.handlePassChallengeBlock(id));
        return;
      }
      case TurnPhase.AwaitingInfluenceLoss: {
        if (s.influenceLossRequest?.playerId !== id) return;
        send(() => engine.handleChooseInfluenceLoss(id, rand(2)));
        return;
      }
      case TurnPhase.AwaitingExchange: {
        if (s.exchangeState?.playerId !== id) return;
        const total = me.aliveInfluenceCount + s.exchangeState.drawnCards.length;
        const idx = Array.from({ length: total }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, me.aliveInfluenceCount);
        send(() => engine.handleChooseExchange(id, idx));
        return;
      }
      case TurnPhase.AwaitingExamineSelection: {
        if (s.examineSelectionState?.targetId !== id) return;
        send(() => engine.handleChooseExamineInfluence(id, rand(2)));
        return;
      }
      case TurnPhase.AwaitingExamineDecision: {
        if (s.examineState?.examinerId !== id) return;
        send(() => engine.handleExamineDecision(id, chance(0.5)));
        return;
      }
      default:
    }
  };

  const scheduleHumans = (s: GameState) => {
    if (s.turnPhase === TurnPhase.GameOver) {
      for (const h of humanTimers.values()) if (h.t) clearTimeout(h.t);
      humanTimers.clear();
      return;
    }
    for (const id of humans) {
      const key = humanKey(s, id);
      const cur = humanTimers.get(id);
      if (cur?.key === key) continue;
      if (cur?.t) clearTimeout(cur.t);
      // ~15% of decisions are left to the timers
      if (chance(0.15)) { humanTimers.set(id, { key, t: null }); continue; }
      const window = s.turnPhase === TurnPhase.AwaitingAction || s.turnPhase === TurnPhase.AwaitingExchange
        || s.turnPhase === TurnPhase.AwaitingInfluenceLoss ? cfg.turnTimerMs : cfg.timerMs;
      const delay = chance(0.1) ? window - rand(30) : rand(Math.min(window, 6000)); // some answer right at expiry
      const t = setTimeout(() => {
        humanTimers.set(id, { key, t: null });
        humanAct(id);
      }, Math.max(0, delay));
      humanTimers.set(id, { key, t });
    }
  };

  engine.setOnStateChange((s) => {
    check(s);
    controller.onStateChange();
    scheduleHumans(s);
  });

  engine.startGame(ids.map(id => ({ id, name: id })), { gameMode: cfg.mode, useInquisitor: cfg.useInquisitor });
  controller.onStateChange();

  // A human may leave mid-game: the seat goes to an optimal bot.
  const leaver = [...humans].find(() => chance(0.15));
  const leaveAt = 5_000 + rand(240_000);
  let elapsed = 0;
  let steps = 0;
  const LIMIT_MS = 4 * 60 * 60 * 1000;
  while (engine.game.status === GameStatus.InProgress && elapsed < LIMIT_MS && steps < 50_000) {
    if (vi.getTimerCount() === 0) { problems.push(`stall: no timers in ${engine.game.turnPhase} at turn ${engine.game.turnNumber}`); break; }
    const before = Date.now();
    vi.advanceTimersToNextTimer();
    elapsed += Date.now() - before;
    steps++;
    if (leaver && humans.has(leaver) && elapsed > leaveAt && engine.game.status === GameStatus.InProgress) {
      const p = engine.game.getPlayer(leaver);
      if (p?.isAlive) {
        humans.delete(leaver);
        const h = humanTimers.get(leaver);
        if (h?.t) clearTimeout(h.t);
        humanTimers.delete(leaver);
        controller.addBot(leaver, 'optimal', leaver);
        replacedAt.set(leaver, Date.now());
        engine.game.log({ message: 'replaced', msg: { key: 'botReplacedLeft', params: { actor: leaver } } as never, eventType: 'bot_replace', actorId: leaver });
        // as SocketHandler.handleBotReplacement: broadcast then evaluate bots
        check(engine.getFullState());
        controller.onStateChange();
        replaced++;
      }
    }
  }
  if (engine.game.status !== GameStatus.Finished) {
    problems.push(`did not finish: turn ${engine.game.turnNumber} phase ${engine.game.turnPhase} after ${Math.round(elapsed / 1000)}s sim, ${steps} steps`);
  }

  // Nothing may happen once the game is over
  vi.advanceTimersByTime(120_000);
  if (broadcastsAfterOver > 0) problems.push(`${broadcastsAfterOver} broadcasts after game over`);

  controller.destroy();
  engine.destroy();
  for (const h of humanTimers.values()) if (h.t) clearTimeout(h.t);
  vi.clearAllTimers();

  return { ok: problems.length === 0, problems, turns: engine.game.turnNumber, botErrors, humanErrors, earlyBlocks, timeouts, replaced };
}

function configs(n: number): Config[] {
  const out: Config[] = [];
  const modes: Array<[GameMode, boolean]> = [[GameMode.Classic, false], [GameMode.Reformation, false], [GameMode.Reformation, true]];
  for (let i = 0; i < n; i++) {
    const [mode, useInquisitor] = modes[i % 3];
    const seats = 2 + (Math.floor(i / 3) % 5);
    const humans = [0, 1, 2, seats][Math.floor(i / 15) % 4] ?? 0;
    out.push({
      mode, useInquisitor, seats, humans: Math.min(humans, seats),
      timerMs: pick([10_000, 15_000, 30_000]),
      turnTimerMs: pick([15_000, 30_000, 60_000]),
      botMinReactionMs: pick([0, 500, 2000, 4000]),
    });
  }
  return out;
}

describe('Game soak: engine + bot controller + scripted humans', () => {
  beforeAll(() => { vi.useFakeTimers(); });
  afterAll(() => { vi.useRealTimers(); });

  it(`plays ${GAMES} games in every mode to a clean finish`, () => {
    const failures: Array<{ cfg: Config; problems: string[] }> = [];
    const botErrors = new Map<string, number>();
    let turns = 0; let early = 0; let timeouts = 0; let replaced = 0; let humanErrors = 0;
    for (const cfg of configs(GAMES)) {
      const r = runGame(cfg);
      turns += r.turns; early += r.earlyBlocks; timeouts += r.timeouts; replaced += r.replaced; humanErrors += r.humanErrors;
      for (const [k, v] of r.botErrors) botErrors.set(k, (botErrors.get(k) ?? 0) + v);
      if (!r.ok) failures.push({ cfg, problems: [...new Set(r.problems)].slice(0, 8) });
    }
    if (process.env.SOAK_OUT) {
      writeFileSync(process.env.SOAK_OUT, JSON.stringify({ games: GAMES, turns, early, timeouts, replaced, humanErrors, botErrors: Object.fromEntries(botErrors), failures: failures.slice(0, 20) }, null, 1));
    }
    expect(failures).toEqual([]);
    // A bot never answers a window twice or after it closed
    expect(Object.fromEntries(botErrors)).toEqual({});
  });
});
