'use client';

import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { ActionType, Character } from '@/shared/types';
import { COUP_COST, FORCED_COUP_THRESHOLD } from '@/shared/constants';
import { CharacterMedallion, CoinGlyph, CoupGlyph } from '../icons';
import { Plaque } from '../game/table/ClaimPlaque';
import { OnboardingShell } from '../onboarding/OnboardingShell';
import { ChapterLayout, DemoSeat, Felt, HIDDEN, HandPlate, lost, shown } from '../onboarding/parts';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { haptic, hapticHeavy } from '../../utils/haptic';
import {
  BLOCK_THREATS,
  INITIAL_TUTORIAL_STATE,
  LAST_CHAPTER,
  TURN_ACTIONS,
  TUTORIAL_CHAPTERS,
  blockersFor,
  canCoup,
  chapterDone,
  mustCoup,
  turnAction,
  tutorialReducer,
  type TutorialEvent,
  type TutorialState,
} from '../../utils/tutorialMachine';

/**
 * "How Coup works" — six short chapters, one idea each, every one played out
 * on a miniature of the real court table with the real cards, seats and claim
 * plaque. The rules state lives in utils/tutorialMachine.ts; this file draws
 * it and turns taps into events.
 */

interface TutorialProps {
  open: boolean;
  onClose: () => void;
  /** "Play a guided game" on the finish screen. Hidden when absent. */
  onPlayGuided?: () => void;
}

const TEACHING = TUTORIAL_CHAPTERS.slice(0, LAST_CHAPTER);
const kicker = (n: number) => `${n + 1} of ${TEACHING.length} · ${TEACHING[n].label}`;

type ChapterProps = { state: TutorialState; send: Dispatch<TutorialEvent> };

export function Tutorial({ open, onClose, onPlayGuided }: TutorialProps) {
  const [state, send] = useReducer(tutorialReducer, INITIAL_TUTORIAL_STATE);

  useEffect(() => {
    if (open) send({ type: 'reset' });
  }, [open]);

  const chapter = TUTORIAL_CHAPTERS[state.chapter];
  const isFinish = chapter.id === 'finish';

  return (
    <OnboardingShell
      open={open}
      onClose={onClose}
      title="How Coup works"
      chapters={TEACHING}
      index={state.chapter}
      onGoto={i => send({ type: 'goto', chapter: i })}
      onNext={() => send({ type: 'next' })}
      onBack={() => send({ type: 'back' })}
      hasNext={!isFinish}
      nextReady={chapterDone(state)}
      nextLabel={state.chapter === LAST_CHAPTER - 1 ? 'Finish' : 'Next'}
      footer={isFinish ? (
        <>
          <button type="button" className="btn-secondary onb-back" onClick={() => { haptic(); onClose(); }}>
            Done
          </button>
          {onPlayGuided && (
            <button type="button" className="btn-primary onb-next onb-cta" onClick={() => { haptic(80); onPlayGuided(); }}>
              Play a guided game
            </button>
          )}
        </>
      ) : undefined}
    >
      {chapter.id === 'goal' && <GoalChapter state={state} send={send} />}
      {chapter.id === 'turn' && <TurnChapter state={state} send={send} />}
      {chapter.id === 'claims' && <ClaimsChapter state={state} send={send} />}
      {chapter.id === 'challenge' && <ChallengeChapter state={state} send={send} />}
      {chapter.id === 'blocks' && <BlocksChapter state={state} send={send} />}
      {chapter.id === 'coins' && <CoinsChapter state={state} send={send} />}
      {chapter.id === 'finish' && <FinishChapter />}
    </OnboardingShell>
  );
}

/* ── 1. The goal ─────────────────────────────────────────────────────── */

const GOAL_COPY = {
  dealt: { note: 'Your two cards are dealt face-down.', cta: 'Look at your cards' },
  peeked: { note: 'Only you can see them. Everyone else sees two card backs.', cta: 'Lose a card' },
  'lost-one': { note: 'A lost card turns face-up for everyone. One left — you are still in.', cta: 'Lose the other' },
  out: { note: 'No cards left: you are out. The last player holding a card wins.', cta: 'Deal again' },
} as const;

function GoalChapter({ state, send }: ChapterProps) {
  const step = state.goal.step;
  const hand = step === 'dealt'
    ? [HIDDEN, HIDDEN]
    : step === 'peeked'
      ? [shown(Character.Duke), shown(Character.Captain)]
      : step === 'lost-one'
        ? [shown(Character.Duke), lost(Character.Captain)]
        : [lost(Character.Duke), lost(Character.Captain)];
  const copy = GOAL_COPY[step];

  return (
    <ChapterLayout
      kicker={kicker(0)}
      title="Keep a card. Outlast the court."
      lede={<>You hold <b>two secret cards</b> — your influence — and 2 coins. Lose both cards and you are out. <b>The last player holding a card wins.</b></>}
      noteTone={step === 'out' ? 'danger' : step === 'lost-one' ? 'done' : 'info'}
      note={copy.note}
      demo={(
        <Felt>
          <HandPlate influences={hand} coins={2} out={step === 'out'} />
          <div className="onb-actions">
            <button
              type="button"
              className={step === 'out' ? 'btn-secondary' : 'btn-primary'}
              onClick={() => { (step === 'peeked' || step === 'lost-one') ? hapticHeavy() : haptic(); send({ type: 'goal/advance' }); }}
            >
              {copy.cta}
            </button>
          </div>
        </Felt>
      )}
    />
  );
}

/* ── 2. Your turn ────────────────────────────────────────────────────── */

function TurnChapter({ state, send }: ChapterProps) {
  const { coins, last, refused } = state.turn;
  const general = TURN_ACTIONS.filter(a => a.claim === null);
  const character = TURN_ACTIONS.filter(a => a.claim !== null);
  const lastDef = last ? turnAction(last) : null;

  const note = !lastDef
    ? 'Tap any action to try it.'
    : refused
      ? `${lastDef.label} costs ${-lastDef.delta}. You have ${coins} ${coins === 1 ? 'coin' : 'coins'}.`
      : lastDef.result;

  const sub: Record<string, string> = {
    income: '+1 coin',
    'foreign-aid': '+2 coins',
    coup: 'Pay 7',
    tax: 'Duke',
    steal: 'Captain',
    assassinate: 'Assassin',
    exchange: 'Ambassador',
  };

  return (
    <ChapterLayout
      kicker={kicker(1)}
      title="On your turn, do one thing"
      lede={<>Three actions are open to <b>anyone</b>. The other four belong to a <b>character</b> — to use one, you claim that character.</>}
      noteTone={refused ? 'danger' : lastDef ? 'done' : 'info'}
      note={note}
      demo={(
        <div className="onb-dock prompt-action">
          <div className="onb-dock-head">
            <span className="onb-group-label">Anyone can</span>
            <span className="court-hand-coins figure onb-purse" aria-label={`${coins} coins`}>
              <CoinGlyph size={16} /> {coins}
            </span>
          </div>
          <div className="onb-tiles onb-tiles-3">
            {general.map(a => (
              <button
                key={a.id}
                type="button"
                className={`onb-tile ${last === a.id ? 'is-picked' : ''}`}
                aria-pressed={last === a.id}
                onClick={() => { haptic(); send({ type: 'turn/take', action: a.id }); }}
              >
                <span className="onb-tile-mark" aria-hidden="true">
                  {a.id === 'coup' ? <CoupGlyph size={22} /> : <CoinGlyph size={22} />}
                </span>
                <span className="onb-tile-text">
                  <span className="onb-tile-name type-display">{a.label}</span>
                  <span className="onb-tile-sub">{sub[a.id]}</span>
                </span>
              </button>
            ))}
          </div>
          <span className="onb-group-label">Claim a character</span>
          <div className="onb-tiles onb-tiles-2">
            {character.map(a => (
              <button
                key={a.id}
                type="button"
                className={`onb-tile ${last === a.id ? 'is-picked' : ''}`}
                aria-pressed={last === a.id}
                onClick={() => { haptic(); send({ type: 'turn/take', action: a.id }); }}
              >
                <span className="onb-tile-mark" aria-hidden="true">
                  <CharacterMedallion character={a.claim!} size={30} />
                </span>
                <span className="onb-tile-text">
                  <span className="onb-tile-name type-display">{a.label}</span>
                  <span className="onb-tile-sub">{sub[a.id]}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    />
  );
}

/* ── 3. Claims & bluffing ────────────────────────────────────────────── */

function ClaimsChapter({ state, send }: ChapterProps) {
  const claimed = state.claims.claimed;
  return (
    <ChapterLayout
      kicker={kicker(2)}
      title="Claim any character — even one you don't hold"
      lede={<>Nobody sees your cards, so you can say anything. You hold a Captain and a Contessa. <b>Say you are the Duke</b> and take Tax.</>}
      noteTone={claimed ? 'done' : 'info'}
      note={claimed
        ? 'A bluff — and it worked. Nobody challenged, so the 3 coins are yours.'
        : 'No Duke in your hand. Claim it anyway.'}
      demo={(
        <Felt>
          <div className="onb-plaque-slot" aria-live="off">
            {claimed
              ? <Plaque actor="You" headline="Tax" character={Character.Duke} actionType={ActionType.Tax} detail="as Duke" />
              : <span className="onb-plaque-ghost">The table</span>}
          </div>
          <HandPlate influences={[shown(Character.Captain), shown(Character.Contessa)]} coins={claimed ? 5 : 2} />
          <div className="onb-actions">
            {claimed ? (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); send({ type: 'claims/reset' }); }}>
                Take it back
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => { hapticHeavy(); send({ type: 'claims/claim' }); }}>
                <CharacterMedallion character={Character.Duke} size={26} />
                Claim Duke · Tax +3
              </button>
            )}
          </div>
        </Felt>
      )}
    />
  );
}

/* ── 4. Challenge ────────────────────────────────────────────────────── */

/** How long the flip plays before the verdict prints. Zero under reduced motion. */
const VERDICT_DELAY_MS = 650;

function useVerdict(key: string, active: boolean): boolean {
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => {
    if (!active) { setReady(false); return; }
    // Coming back to an already-resolved demo shows the verdict at once.
    if (reduced || firstRender.current) { setReady(true); return; }
    setReady(false);
    const t = setTimeout(() => setReady(true), VERDICT_DELAY_MS);
    return () => clearTimeout(t);
  }, [active, key, reduced]);
  useEffect(() => { firstRender.current = false; }, []);
  return ready;
}

function ChallengeChapter({ state, send }: ChapterProps) {
  const { round, stage } = state.challenge;
  const revealed = stage === 'revealed';
  const verdict = useVerdict(`${round}-${stage}`, revealed);
  const truthful = round === 1;

  // Round 0: Alex holds Captain + Assassin and is bluffing the Duke.
  // Round 1: Alex really holds the Duke.
  const alexCards = !revealed
    ? [HIDDEN, HIDDEN]
    : truthful
      ? [shown(Character.Duke), HIDDEN]
      : [lost(Character.Captain), HIDDEN];
  const yourCards = revealed && truthful && verdict
    ? [lost(Character.Contessa), shown(Character.Assassin)]
    : [shown(Character.Contessa), shown(Character.Assassin)];

  let note: string;
  let tone: 'info' | 'danger' | 'done' = 'info';
  if (stage === 'passed') {
    note = 'Alex takes 3 coins. Was it a bluff? You will never know.';
  } else if (!revealed) {
    note = truthful ? 'Alex claims the Duke again. Challenge it.' : 'Alex claims the Duke to take Tax. Bluff or not?';
  } else if (!verdict) {
    note = 'Alex shows a card…';
  } else if (truthful) {
    note = 'Alex really had the Duke — so you lose a card. Alex shuffles the Duke away and draws a new one.';
    tone = 'danger';
  } else {
    note = 'Caught! Alex had no Duke, so Alex loses a card.';
    tone = 'done';
  }

  return (
    <ChapterLayout
      kicker={kicker(3)}
      title="Think it's a lie? Challenge!"
      lede={<>Anyone can challenge a claim. The claimed card is checked, and <b>whoever was wrong loses a card</b>.</>}
      noteTone={tone}
      note={note}
      demo={(
        <Felt>
          <div className="onb-row">
            <DemoSeat name="Alex" influences={alexCards} coins={stage === 'passed' ? 5 : 2} isTurn={!revealed} />
            <div className="onb-plaque-slot">
              <Plaque
                key={round}
                actor="Alex"
                headline="Tax"
                character={Character.Duke}
                actionType={ActionType.Tax}
                detail="as Duke"
              />
            </div>
          </div>
          <div className="onb-actions">
            {stage === 'claim' && (
              <>
                <button type="button" className="btn-danger" onClick={() => { hapticHeavy(); send({ type: 'challenge/challenge' }); }}>
                  Challenge!
                </button>
                {!truthful && (
                  <button type="button" className="btn-secondary" onClick={() => { haptic(); send({ type: 'challenge/pass' }); }}>
                    Let it go
                  </button>
                )}
              </>
            )}
            {stage === 'passed' && (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); send({ type: 'challenge/rewind' }); }}>
                Rewind
              </button>
            )}
            {revealed && verdict && (
              <button
                type="button"
                className={truthful ? 'btn-secondary' : 'btn-primary'}
                onClick={() => { haptic(); send({ type: 'challenge/next-round' }); }}
              >
                {truthful ? 'Play both again' : 'Next: a true claim'}
              </button>
            )}
          </div>
          <HandPlate influences={yourCards} compact />
        </Felt>
      )}
    />
  );
}

/* ── 5. Blocks ───────────────────────────────────────────────────────── */

const BLOCK_CHOICES = [Character.Duke, Character.Assassin, Character.Captain, Character.Ambassador, Character.Contessa];

const BLOCK_RESULT = [
  'Blocked. A Duke stops Foreign Aid — anyone may claim it.',
  'Blocked. The Captain and the Ambassador both stop a Steal.',
  'Blocked. Only the Contessa stops an Assassination.',
];

const THREAT_ASK = [
  'Alex takes Foreign Aid. Who blocks it?',
  'Alex steals from you. Who blocks it?',
  'Alex assassinates you. Who blocks it?',
];

function BlocksChapter({ state, send }: ChapterProps) {
  const { threat, blocked, miss } = state.blocks;
  const t = BLOCK_THREATS[threat];
  const correct = blockersFor(threat);
  const actionType = t.action === 'Foreign Aid' ? ActionType.ForeignAid : t.action === 'Steal' ? ActionType.Steal : ActionType.Assassinate;
  const blockedWith = blocked ? correct[0] : null;
  const [shakeKey, setShakeKey] = useState(0);
  const last = threat === BLOCK_THREATS.length - 1;

  const note = blocked
    ? `${BLOCK_RESULT[threat]}${last ? ' A block is a claim too — Alex could challenge it.' : ''}`
    : miss
      ? `${miss} can't block ${t.action}. Try another.`
      : THREAT_ASK[threat];

  return (
    <ChapterLayout
      kicker={kicker(4)}
      title="Block it with the right character"
      lede={<>Some actions can be stopped by claiming a character that counters them. <b>Tap the one that blocks</b> each threat.</>}
      noteTone={blocked ? 'done' : miss ? 'danger' : 'info'}
      note={note}
      demo={(
        <Felt>
          <div className="onb-threat-count">
            Threat <span className="figure">{threat + 1}</span> of <span className="figure">{BLOCK_THREATS.length}</span>
          </div>
          <div className="claim-stack onb-plaque-slot" key={threat}>
            <Plaque
              actor="Alex"
              headline={t.action}
              character={t.claim}
              actionType={actionType}
              blocked={blocked}
              detail={t.claim ? <>as {t.claim}{t.targeted ? ' · on You' : ''}</> : undefined}
            />
            {blockedWith && (
              <Plaque isBlock actor="You" headline="Blocks" character={blockedWith} detail={<>as {blockedWith}</>} />
            )}
          </div>
          {!blocked ? (
            <div className="onb-blockers" role="group" aria-label="Who blocks it?">
              {BLOCK_CHOICES.map(c => {
                const wrong = miss === c;
                return (
                  <span
                    key={c}
                    className={`refusal-host ${wrong ? 'is-refusing' : ''}`}
                    data-shake={shakeKey % 2 ? 'b' : 'a'}
                  >
                    <button
                      type="button"
                      className="onb-blocker"
                      onClick={() => {
                        const right = correct.includes(c);
                        if (right) hapticHeavy(); else { haptic(30); setShakeKey(k => k + 1); }
                        send({ type: 'blocks/pick', character: c });
                      }}
                    >
                      <CharacterMedallion character={c} size={34} />
                      <span className="onb-blocker-name">{c}</span>
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="onb-actions">
              <button type="button" className={last ? 'btn-secondary' : 'btn-primary'} onClick={() => { haptic(); send({ type: 'blocks/next' }); }}>
                {last ? 'Start over' : 'Next threat'}
              </button>
            </div>
          )}
        </Felt>
      )}
    />
  );
}

/* ── 6. Coins ────────────────────────────────────────────────────────── */

function CoinsChapter({ state, send }: ChapterProps) {
  const { coins, couped, refusal } = state.coins;
  const forced = mustCoup(coins);
  const ready = canCoup(coins);
  const slots = Math.max(FORCED_COUP_THRESHOLD, coins);

  const note = refusal
    ?? (couped
      ? 'Coup! Alex loses a card — nobody could block or challenge it.'
      : forced
        ? `${coins} coins: you must Coup now. Nothing else is allowed.`
        : ready
          ? '7 coins: Coup is ready. Keep collecting to see the 10-coin rule.'
          : `You have ${coins} coins. Collect more, then Coup.`);

  return (
    <ChapterLayout
      kicker={kicker(5)}
      title="7 coins buy a Coup. At 10 you must."
      lede={<>A Coup costs 7 and <b>can't be blocked or challenged</b> — a card is lost, guaranteed. With 10 or more coins, Coup is your only move.</>}
      noteTone={refusal || forced ? 'danger' : couped ? 'done' : 'info'}
      note={note}
      demo={(
        <Felt>
          <DemoSeat
            name="Alex"
            influences={couped ? [lost(Character.Ambassador), HIDDEN] : [HIDDEN, HIDDEN]}
            coins={3}
            isTarget={ready && !couped}
          />
          <div className="onb-meter" role="img" aria-label={`${coins} coins of 10`}>
            {Array.from({ length: slots }, (_, i) => (
              <span
                key={i}
                className={`onb-meter-slot ${i < coins ? 'is-full' : ''} ${i === COUP_COST - 1 ? 'is-coup' : ''} ${i === FORCED_COUP_THRESHOLD - 1 ? 'is-must' : ''}`}
              />
            ))}
            <span className="onb-meter-mark" style={{ ['--at' as string]: COUP_COST / slots }}>7 · Coup</span>
            <span className="onb-meter-mark is-must" style={{ ['--at' as string]: FORCED_COUP_THRESHOLD / slots }}>10 · Must</span>
          </div>
          <div className="onb-actions onb-actions-3">
            {couped ? (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); send({ type: 'coins/reset' }); }}>
                Again
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  data-ineligible={forced ? 'true' : undefined}
                  aria-disabled={forced || undefined}
                  onClick={() => { haptic(); send({ type: 'coins/take', amount: 1 }); }}
                >
                  Income +1
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  data-ineligible={forced ? 'true' : undefined}
                  aria-disabled={forced || undefined}
                  onClick={() => { haptic(); send({ type: 'coins/take', amount: 3 }); }}
                >
                  Tax +3
                </button>
                <button
                  type="button"
                  className={ready ? 'btn-danger' : 'btn-secondary'}
                  data-ineligible={ready ? undefined : 'true'}
                  aria-disabled={!ready || undefined}
                  onClick={() => { ready ? hapticHeavy() : haptic(30); send({ type: 'coins/coup' }); }}
                >
                  <CoupGlyph size={18} /> Coup
                </button>
              </>
            )}
          </div>
          <span className="onb-purse-line">
            You: <span className="figure">{coins}</span> {coins === 1 ? 'coin' : 'coins'}
          </span>
        </Felt>
      )}
    />
  );
}

/* ── Finish: the reference card ──────────────────────────────────────── */

const REFERENCE: Array<{ character: Character; does: string; blocks: string; note?: string }> = [
  { character: Character.Duke, does: 'Tax: take 3 coins', blocks: 'Blocks Foreign Aid' },
  { character: Character.Assassin, does: 'Assassinate: pay 3, a card is lost', blocks: 'Blocks nothing' },
  { character: Character.Captain, does: 'Steal: take 2 coins', blocks: 'Blocks Steal' },
  { character: Character.Ambassador, does: 'Exchange: swap with the deck', blocks: 'Blocks Steal' },
  { character: Character.Contessa, does: 'No action', blocks: 'Blocks Assassination' },
  { character: Character.Inquisitor, does: 'Exchange or Examine', blocks: 'Blocks Steal', note: 'Reformation' },
];

function FinishChapter() {
  return (
    <>
      <div className="onb-text">
        <p className="onb-kicker">Ready</p>
        <h3 className="onb-title type-display">That is the whole game</h3>
        <p className="onb-lede">Anyone can do anything — the cards only matter when someone calls you on it. Here is every character, for reference.</p>
      </div>
      <ul className="onb-reference onb-demo" aria-label="The six characters">
        {REFERENCE.map(r => (
          <li key={r.character} className="onb-ref">
            <CharacterMedallion character={r.character} size={40} />
            <span className="onb-ref-text">
              <span className="onb-ref-name type-display">{r.character}</span>
              <span className="onb-ref-does">{r.does}</span>
              <span className="onb-ref-blocks">{r.blocks}{r.note ? <> · <i>{r.note}</i></> : null}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="onb-note is-info">General actions for everyone: Income +1 · Foreign Aid +2 · Coup for 7.</p>
    </>
  );
}
