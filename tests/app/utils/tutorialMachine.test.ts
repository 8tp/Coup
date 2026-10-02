import { describe, expect, it } from 'vitest';
import { Character } from '@/shared/types';
import {
  BLOCK_THREATS,
  COINS_DEMO_START,
  INITIAL_TUTORIAL_STATE,
  LAST_CHAPTER,
  TUTORIAL_CHAPTERS,
  blockersFor,
  chapterDone,
  tutorialReducer,
  type TutorialEvent,
  type TutorialState,
} from '@/app/utils/tutorialMachine';

function run(events: TutorialEvent[], from: TutorialState = INITIAL_TUTORIAL_STATE): TutorialState {
  return events.reduce(tutorialReducer, from);
}

describe('tutorial chapters', () => {
  it('has six teaching chapters and a finish', () => {
    expect(TUTORIAL_CHAPTERS.map(c => c.id)).toEqual(['goal', 'turn', 'claims', 'challenge', 'blocks', 'coins', 'finish']);
  });

  it('moves forward and back without leaving the range', () => {
    expect(run([{ type: 'back' }]).chapter).toBe(0);
    expect(run([{ type: 'next' }, { type: 'next' }]).chapter).toBe(2);
    expect(run(Array(20).fill({ type: 'next' })).chapter).toBe(LAST_CHAPTER);
    expect(run([{ type: 'goto', chapter: 99 }]).chapter).toBe(LAST_CHAPTER);
    expect(run([{ type: 'goto', chapter: -3 }]).chapter).toBe(0);
  });

  it('keeps a demonstration where the player left it when they come back', () => {
    const s = run([{ type: 'goal/advance' }, { type: 'next' }, { type: 'back' }]);
    expect(s.chapter).toBe(0);
    expect(s.goal.step).toBe('peeked');
  });

  it('never locks Next, but reports when each demonstration is done', () => {
    const s = run([{ type: 'next' }, { type: 'next' }]);
    expect(s.chapter).toBe(2);
    expect(chapterDone(s)).toBe(false);
    expect(chapterDone(run([{ type: 'claims/claim' }], s))).toBe(true);
    expect(chapterDone(INITIAL_TUTORIAL_STATE, 'finish')).toBe(true);
  });

  it('reset returns to the very start', () => {
    expect(run([{ type: 'next' }, { type: 'claims/claim' }, { type: 'reset' }])).toEqual(INITIAL_TUTORIAL_STATE);
  });
});

describe('the goal', () => {
  it('deals, peeks, loses one, then is out, then deals again', () => {
    const steps: string[] = [];
    let s = INITIAL_TUTORIAL_STATE;
    for (let i = 0; i < 5; i++) {
      steps.push(s.goal.step);
      s = tutorialReducer(s, { type: 'goal/advance' });
    }
    expect(steps).toEqual(['dealt', 'peeked', 'lost-one', 'out', 'peeked']);
  });

  it('is done once a card has been lost', () => {
    expect(chapterDone(run([{ type: 'goal/advance' }]), 'goal')).toBe(false);
    expect(chapterDone(run([{ type: 'goal/advance' }, { type: 'goal/advance' }]), 'goal')).toBe(true);
  });
});

describe('your turn', () => {
  it('pays and collects coins per action', () => {
    expect(run([{ type: 'turn/take', action: 'income' }]).turn.coins).toBe(3);
    expect(run([{ type: 'turn/take', action: 'foreign-aid' }]).turn.coins).toBe(4);
    expect(run([{ type: 'turn/take', action: 'tax' }]).turn.coins).toBe(5);
  });

  it('refuses what you cannot afford and keeps your coins', () => {
    const s = run([{ type: 'turn/take', action: 'coup' }]);
    expect(s.turn).toEqual({ coins: 2, last: 'coup', refused: true });
    expect(chapterDone(s, 'turn')).toBe(true);
  });
});

describe('challenge', () => {
  it('shows the caught bluff, then the truthful claim', () => {
    let s = run([{ type: 'challenge/challenge' }]);
    expect(s.challenge).toEqual({ round: 0, stage: 'revealed' });
    expect(chapterDone(s, 'challenge')).toBe(false);

    s = run([{ type: 'challenge/next-round' }, { type: 'challenge/challenge' }], s);
    expect(s.challenge).toEqual({ round: 1, stage: 'revealed' });
    expect(chapterDone(s, 'challenge')).toBe(true);
  });

  it('letting it go can be rewound', () => {
    const passed = run([{ type: 'challenge/pass' }]);
    expect(passed.challenge.stage).toBe('passed');
    // a challenge after passing is not possible until rewound
    expect(run([{ type: 'challenge/challenge' }], passed).challenge.stage).toBe('passed');
    expect(run([{ type: 'challenge/rewind' }], passed).challenge).toEqual({ round: 0, stage: 'claim' });
  });
});

describe('blocks', () => {
  it('knows who blocks what', () => {
    expect(blockersFor(0)).toEqual([Character.Duke]);
    expect(blockersFor(1)).toEqual([Character.Captain, Character.Ambassador]);
    expect(blockersFor(1, true)).toEqual([Character.Captain, Character.Inquisitor]);
    expect(blockersFor(2)).toEqual([Character.Contessa]);
  });

  it('a wrong pick is remembered and refused; the right one blocks', () => {
    let s = run([{ type: 'blocks/pick', character: Character.Contessa }]);
    expect(s.blocks).toEqual({ threat: 0, blocked: false, miss: Character.Contessa });
    s = run([{ type: 'blocks/pick', character: Character.Duke }], s);
    expect(s.blocks).toEqual({ threat: 0, blocked: true, miss: null });
  });

  it('either Steal blocker works', () => {
    const steal = run([{ type: 'blocks/next' }]);
    expect(run([{ type: 'blocks/pick', character: Character.Captain }], steal).blocks.blocked).toBe(true);
    expect(run([{ type: 'blocks/pick', character: Character.Ambassador }], steal).blocks.blocked).toBe(true);
  });

  it('is done after the last threat is blocked, then cycles', () => {
    const s = run([
      { type: 'blocks/pick', character: Character.Duke },
      { type: 'blocks/next' },
      { type: 'blocks/pick', character: Character.Captain },
      { type: 'blocks/next' },
      { type: 'blocks/pick', character: Character.Contessa },
    ]);
    expect(s.blocks.threat).toBe(BLOCK_THREATS.length - 1);
    expect(chapterDone(s, 'blocks')).toBe(true);
    expect(run([{ type: 'blocks/next' }], s).blocks.threat).toBe(0);
  });
});

describe('coins', () => {
  it('refuses a Coup under 7 and says how many are missing', () => {
    const s = run([{ type: 'coins/coup' }]);
    expect(s.coins.couped).toBe(false);
    expect(s.coins.coins).toBe(COINS_DEMO_START);
    expect(s.coins.refusal).toContain('2 more coins');
  });

  it('allows a Coup at 7 and pays for it', () => {
    const s = run([{ type: 'coins/take', amount: 1 }, { type: 'coins/take', amount: 1 }, { type: 'coins/coup' }]);
    expect(s.coins).toEqual({ coins: 0, couped: true, refusal: null });
    expect(chapterDone(s, 'coins')).toBe(true);
  });

  it('at 10 coins anything but a Coup is refused', () => {
    const ten = run([{ type: 'coins/take', amount: 3 }, { type: 'coins/take', amount: 3 }]);
    expect(ten.coins.coins).toBe(11);
    const refused = run([{ type: 'coins/take', amount: 1 }], ten);
    expect(refused.coins.coins).toBe(11);
    expect(refused.coins.refusal).toContain('must Coup');
    expect(run([{ type: 'coins/coup' }], refused).coins).toEqual({ coins: 4, couped: true, refusal: null });
  });

  it('reset deals the demonstration again', () => {
    const s = run([{ type: 'coins/take', amount: 3 }, { type: 'coins/coup' }, { type: 'coins/reset' }]);
    expect(s.coins).toEqual(INITIAL_TUTORIAL_STATE.coins);
  });
});
