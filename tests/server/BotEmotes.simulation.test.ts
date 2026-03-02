import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { BotController } from '@/server/BotController';
import { RoomPlayer, GameStatus } from '@/shared/types';
import {
  BOT_ACTION_DELAY_MAX,
  BOT_EMOTE_DELAY_MAX,
  BOT_EMOTE_COOLDOWN_MS,
  REACTIONS,
} from '@/shared/constants';

interface EmoteRecord {
  botId: string;
  botName: string;
  reactionId: string;
  fakeTime: number;
}

interface BotPersonalityInfo {
  id: string;
  name: string;
  emotiveness: number;
  meanness: number;
}

interface SimResult {
  emotes: EmoteRecord[];
  winner: string | null;
  turnCount: number;
  logEntries: Array<{ eventType: string; message: string }>;
  personalities: BotPersonalityInfo[];
}

function createAllBotGame(numBots: number): {
  engine: GameEngine;
  botController: BotController;
  botPlayers: RoomPlayer[];
} {
  const engine = new GameEngine('SIM001', 15_000);

  const playerInfos: Array<{ id: string; name: string }> = [];
  const botPlayers: RoomPlayer[] = [];

  const personalities: Array<'aggressive' | 'conservative' | 'optimal'> = ['aggressive', 'conservative', 'optimal'];

  for (let i = 0; i < numBots; i++) {
    const id = `bot${i + 1}`;
    const name = `Bot-${i + 1}`;
    const personality = personalities[i % 3];
    playerInfos.push({ id, name });
    botPlayers.push({
      id,
      name,
      socketId: '',
      connected: true,
      isBot: true,
      personality,
    });
  }

  engine.startGame(playerInfos);

  const botController = new BotController(engine, botPlayers);

  engine.setOnStateChange(() => {
    botController.onStateChange();
  });

  return { engine, botController, botPlayers };
}

function getPersonalities(bc: BotController): BotPersonalityInfo[] {
  const bots = (bc as unknown as { bots: Array<{ id: string; name: string; emotiveness: number; meanness: number }> }).bots;
  return bots.map(b => ({ id: b.id, name: b.name, emotiveness: b.emotiveness, meanness: b.meanness }));
}

function runSimulatedGame(numBots: number): SimResult {
  const { engine, botController } = createAllBotGame(numBots);

  const personalities = getPersonalities(botController);
  const emotes: EmoteRecord[] = [];

  botController.setOnBotEmote((botId, botName, reactionId) => {
    emotes.push({
      botId,
      botName,
      reactionId,
      fakeTime: Date.now(),
    });
  });

  // Kick off the game loop
  botController.onStateChange();

  let iterations = 0;
  const maxIterations = 2000;

  while (engine.game.status === GameStatus.InProgress && iterations < maxIterations) {
    vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + BOT_EMOTE_DELAY_MAX + 500);
    iterations++;
  }

  const result: SimResult = {
    emotes,
    winner: engine.game.winnerId,
    turnCount: engine.game.turnNumber,
    logEntries: engine.game.actionLog.map(e => ({
      eventType: e.eventType,
      message: e.message,
    })),
    personalities,
  };

  botController.destroy();
  engine.destroy();

  return result;
}

// Categorize a reaction as nice, mean, or neutral
const NICE_REACTIONS = new Set(['gg', 'nice_bluff', 'rip', 'wow', 'sweat']);
const MEAN_REACTIONS = new Set(['salty', 'cope', 'big_brain', 'eyes', 'lol', 'sus']);

function reactionVibe(id: string): 'nice' | 'mean' | 'neutral' {
  if (NICE_REACTIONS.has(id)) return 'nice';
  if (MEAN_REACTIONS.has(id)) return 'mean';
  return 'neutral';
}

describe('Bot Emote Simulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show personality-driven emote variety across games', () => {
    const NUM_GAMES = 10;
    const allResults: SimResult[] = [];

    for (let i = 0; i < NUM_GAMES; i++) {
      const numBots = 3 + (i % 3); // 3, 4, 5 bots
      allResults.push(runSimulatedGame(numBots));
    }

    // ── Report ──
    console.log('\n════════════════════════════════════════════');
    console.log('    BOT EMOTE + PERSONALITY SIMULATION');
    console.log('════════════════════════════════════════════\n');

    let totalEmotes = 0;
    let totalTurns = 0;
    const reactionCounts: Record<string, number> = {};
    const botStats: Record<string, { emotes: number; nice: number; mean: number; emotiveness: number; meanness: number }> = {};
    const triggerEventCounts: Record<string, number> = {};

    for (let i = 0; i < allResults.length; i++) {
      const r = allResults[i];
      const numBots = 3 + (i % 3);
      totalEmotes += r.emotes.length;
      totalTurns += r.turnCount;

      console.log(`── Game ${i + 1} (${numBots} bots, ${r.turnCount} turns) ──`);
      console.log(`   Winner: ${r.winner}`);

      // Show personalities
      for (const p of r.personalities) {
        const emotTag = p.emotiveness < 0.3 ? 'quiet' : p.emotiveness > 0.7 ? 'chatty' : 'moderate';
        const meanTag = p.meanness < 0.3 ? 'nice' : p.meanness > 0.7 ? 'mean' : 'mixed';
        console.log(`   ${p.name}: emotiveness=${p.emotiveness.toFixed(2)} (${emotTag}), meanness=${p.meanness.toFixed(2)} (${meanTag})`);
      }

      console.log(`   Emotes fired: ${r.emotes.length}`);

      if (r.emotes.length > 0) {
        for (const e of r.emotes) {
          const reaction = REACTIONS.find(rx => rx.id === e.reactionId);
          const vibe = reactionVibe(e.reactionId);
          const vibeTag = vibe === 'nice' ? '[nice]' : vibe === 'mean' ? '[mean]' : '';
          console.log(`     ${e.botName} → ${reaction?.emoji ?? '?'} ${reaction?.label ?? e.reactionId} ${vibeTag}`);
          reactionCounts[e.reactionId] = (reactionCounts[e.reactionId] || 0) + 1;

          // Track per-bot stats
          const key = `game${i + 1}:${e.botName}`;
          if (!botStats[key]) {
            const pers = r.personalities.find(p => p.id === e.botId)!;
            botStats[key] = { emotes: 0, nice: 0, mean: 0, emotiveness: pers.emotiveness, meanness: pers.meanness };
          }
          botStats[key].emotes++;
          if (vibe === 'nice') botStats[key].nice++;
          if (vibe === 'mean') botStats[key].mean++;
        }
      }

      // Count emote-triggering event types in the log
      const triggerTypes = new Set(['coup', 'assassination', 'challenge_success', 'challenge_fail',
        'elimination', 'block', 'action_resolve', 'win']);
      for (const entry of r.logEntries) {
        if (triggerTypes.has(entry.eventType)) {
          triggerEventCounts[entry.eventType] = (triggerEventCounts[entry.eventType] || 0) + 1;
        }
      }

      console.log('');
    }

    console.log('═══════════════════════════════');
    console.log('      AGGREGATE STATS');
    console.log('═══════════════════════════════\n');
    console.log(`  Total games: ${NUM_GAMES}`);
    console.log(`  Total turns: ${totalTurns}`);
    console.log(`  Total emotes: ${totalEmotes}`);
    console.log(`  Avg emotes/game: ${(totalEmotes / NUM_GAMES).toFixed(1)}`);
    console.log('');

    console.log('  Reaction breakdown:');
    for (const [id, count] of Object.entries(reactionCounts).sort((a, b) => b[1] - a[1])) {
      const reaction = REACTIONS.find(r => r.id === id);
      const vibe = reactionVibe(id);
      console.log(`    ${reaction?.emoji ?? '?'} ${(reaction?.label ?? id).padEnd(14)} ${String(count).padStart(3)}  ${vibe}`);
    }
    console.log('');

    // Count unique reaction types
    const uniqueReactions = Object.keys(reactionCounts);
    console.log(`  Unique reaction types used: ${uniqueReactions.length} / ${REACTIONS.length}`);

    // Nice vs mean totals
    let totalNice = 0, totalMean = 0;
    for (const [id, count] of Object.entries(reactionCounts)) {
      const v = reactionVibe(id);
      if (v === 'nice') totalNice += count;
      if (v === 'mean') totalMean += count;
    }
    console.log(`  Nice reactions: ${totalNice}  |  Mean reactions: ${totalMean}`);
    console.log('');

    // Per-bot personality correlation
    console.log('  Per-bot personality → emote vibe:');
    for (const [key, stats] of Object.entries(botStats).sort((a, b) => b[1].meanness - a[1].meanness)) {
      const label = key.split(':')[1];
      const game = key.split(':')[0];
      console.log(`    ${game} ${label}: meanness=${stats.meanness.toFixed(2)} → ${stats.nice} nice, ${stats.mean} mean (${stats.emotes} total)`);
    }
    console.log('');

    console.log('  Trigger events in logs (opportunities):');
    for (const [type, count] of Object.entries(triggerEventCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type}: ${count}`);
    }
    console.log('');

    // ── Assertions ──

    // All games should complete
    for (const r of allResults) {
      expect(r.winner).not.toBeNull();
    }

    // At least some emotes should fire across 10 games
    expect(totalEmotes).toBeGreaterThan(0);

    // All emote reaction IDs should be valid
    for (const r of allResults) {
      for (const e of r.emotes) {
        expect(REACTIONS.some(rx => rx.id === e.reactionId)).toBe(true);
      }
    }

    // Should have at least 3 different reaction types across all games (variety check)
    expect(uniqueReactions.length).toBeGreaterThanOrEqual(3);
  });

  it('should respect cooldown between emotes from the same bot', () => {
    const { engine, botController } = createAllBotGame(4);

    const emotes: EmoteRecord[] = [];
    botController.setOnBotEmote((botId, botName, reactionId) => {
      emotes.push({ botId, botName, reactionId, fakeTime: Date.now() });
    });

    botController.onStateChange();

    let iterations = 0;
    while (engine.game.status === GameStatus.InProgress && iterations < 2000) {
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + BOT_EMOTE_DELAY_MAX + 500);
      iterations++;
    }

    const byBot = new Map<string, number[]>();
    for (const e of emotes) {
      if (!byBot.has(e.botId)) byBot.set(e.botId, []);
      byBot.get(e.botId)!.push(e.fakeTime);
    }

    for (const [, times] of byBot) {
      for (let i = 1; i < times.length; i++) {
        const gap = times[i] - times[i - 1];
        expect(gap).toBeGreaterThanOrEqual(BOT_EMOTE_COOLDOWN_MS);
      }
    }

    botController.destroy();
    engine.destroy();
  });

  it('should not fire emotes after BotController is destroyed', () => {
    const { engine, botController } = createAllBotGame(3);

    const emotes: EmoteRecord[] = [];
    botController.setOnBotEmote((botId, botName, reactionId) => {
      emotes.push({ botId, botName, reactionId, fakeTime: Date.now() });
    });

    botController.onStateChange();

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + BOT_EMOTE_DELAY_MAX + 500);
    }

    const emotesBeforeDestroy = emotes.length;
    botController.destroy();

    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + BOT_EMOTE_DELAY_MAX + 500);
    }

    expect(emotes.length).toBe(emotesBeforeDestroy);
    engine.destroy();
  });

  it('mean bots should use meaner reactions than nice bots', () => {
    const NUM_GAMES = 30;
    let niceBot_niceReactions = 0;
    let niceBot_meanReactions = 0;
    let meanBot_niceReactions = 0;
    let meanBot_meanReactions = 0;

    for (let i = 0; i < NUM_GAMES; i++) {
      const engine = new GameEngine(`MEAN${i}`, 15_000);

      const playerInfos = [
        { id: 'nice', name: 'NiceBot' },
        { id: 'mean', name: 'MeanBot' },
        { id: 'fill', name: 'Filler' },
      ];

      engine.startGame(playerInfos);

      const botPlayers: RoomPlayer[] = [
        { id: 'nice', name: 'NiceBot', socketId: '', connected: true, isBot: true, personality: 'optimal' },
        { id: 'mean', name: 'MeanBot', socketId: '', connected: true, isBot: true, personality: 'optimal' },
        { id: 'fill', name: 'Filler', socketId: '', connected: true, isBot: true, personality: 'optimal' },
      ];

      const bc = new BotController(engine, botPlayers);

      // Force personality traits
      const bots = (bc as unknown as { bots: Array<{ emotiveness: number; meanness: number; id: string }> }).bots;
      for (const b of bots) {
        b.emotiveness = 0.9; // everyone chatty so we get enough data
      }
      bots.find(b => b.id === 'nice')!.meanness = 0.05; // almost always picks nice pool
      bots.find(b => b.id === 'mean')!.meanness = 0.95; // almost always picks mean pool

      bc.setOnBotEmote((botId, _botName, reactionId) => {
        const vibe = reactionVibe(reactionId);
        if (botId === 'nice') {
          if (vibe === 'nice') niceBot_niceReactions++;
          if (vibe === 'mean') niceBot_meanReactions++;
        } else if (botId === 'mean') {
          if (vibe === 'nice') meanBot_niceReactions++;
          if (vibe === 'mean') meanBot_meanReactions++;
        }
      });

      engine.setOnStateChange(() => bc.onStateChange());
      bc.onStateChange();

      let iter = 0;
      while (engine.game.status === GameStatus.InProgress && iter < 2000) {
        vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + BOT_EMOTE_DELAY_MAX + 500);
        iter++;
      }

      bc.destroy();
      engine.destroy();
    }

    console.log('\n── Meanness Personality Test (30 games) ──');
    console.log(`  NiceBot (meanness=0.05): ${niceBot_niceReactions} nice, ${niceBot_meanReactions} mean`);
    console.log(`  MeanBot (meanness=0.95): ${meanBot_niceReactions} nice, ${meanBot_meanReactions} mean`);

    const niceBotTotal = niceBot_niceReactions + niceBot_meanReactions;
    const meanBotTotal = meanBot_niceReactions + meanBot_meanReactions;

    if (niceBotTotal > 0) {
      console.log(`  NiceBot nice%: ${(100 * niceBot_niceReactions / niceBotTotal).toFixed(0)}%`);
    }
    if (meanBotTotal > 0) {
      console.log(`  MeanBot mean%: ${(100 * meanBot_meanReactions / meanBotTotal).toFixed(0)}%`);
    }

    // With 30 games there should be enough data to see the trend
    // NiceBot should have more nice reactions, MeanBot more mean ones
    if (niceBotTotal >= 5 && meanBotTotal >= 5) {
      const niceBotNiceRatio = niceBot_niceReactions / niceBotTotal;
      const meanBotMeanRatio = meanBot_meanReactions / meanBotTotal;
      expect(niceBotNiceRatio).toBeGreaterThan(0.5);
      expect(meanBotMeanRatio).toBeGreaterThan(0.5);
    }
  });
});
