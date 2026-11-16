'use client';

import { useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { ActionType, Character, GameMode } from '@/shared/types';
import { COUP_COST, FORCED_COUP_THRESHOLD, STARTING_COINS } from '@/shared/constants';
import { useT, actionName, characterName, gameModeName } from '../../i18n';
import { CharacterMedallion, CoinGlyph, CoupGlyph } from '../icons';
import { Plaque } from '../game/table/ClaimPlaque';
import { OnboardingShell } from '../onboarding/OnboardingShell';
import { ChapterLayout, DemoSeat, Felt, HIDDEN, HandPlate, lost, shown } from '../onboarding/parts';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { haptic, hapticHeavy } from '../../utils/haptic';
import { INCOME_COINS, TAX_COINS, learnParams } from '../../utils/learnText';
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
  type TurnActionId,
  type TutorialEvent,
  type TutorialState,
} from '../../utils/tutorialMachine';

/**
 * "How Coup works" — six short chapters, one idea each, every one played out
 * on a miniature of the real court table with the real cards, seats and claim
 * plaque. The rules state lives in utils/tutorialMachine.ts; this file draws
 * it and turns taps into events. Every word is a `tutorial.*` message; game
 * nouns and rule numbers are params (utils/learnText.ts).
 */

interface TutorialProps {
  open: boolean;
  onClose: () => void;
  /** "Play a guided game" on the finish screen. Hidden when absent. */
  onPlayGuided?: () => void;
}

const TEACHING = TUTORIAL_CHAPTERS.slice(0, LAST_CHAPTER);

/** The opponent in the demonstrations: a name, never translated. */
const ALEX = 'Alex';

type ChapterProps = { state: TutorialState; send: Dispatch<TutorialEvent> };

/** `{player}` in a demonstration sentence: a name, isolated for right-to-left text. */
const player = (name: string) => <bdi>{name}</bdi>;
/** `<fig>`: a number set as a figure. */
const fig = (chunks: ReactNode) => <span className="figure">{chunks}</span>;

export function Tutorial({ open, onClose, onPlayGuided }: TutorialProps) {
  const t = useT();
  const [state, send] = useReducer(tutorialReducer, INITIAL_TUTORIAL_STATE);
  const chapters = useMemo(
    () => TEACHING.map(c => ({ id: c.id, label: t(`tutorial.chapter.${c.id}`) })),
    [t],
  );

  useEffect(() => {
    if (open) send({ type: 'reset' });
  }, [open]);

  const chapter = TUTORIAL_CHAPTERS[state.chapter];
  const isFinish = chapter.id === 'finish';

  return (
    <OnboardingShell
      open={open}
      onClose={onClose}
      title={t('tutorial.basics.title')}
      chapters={chapters}
      index={state.chapter}
      onGoto={i => send({ type: 'goto', chapter: i })}
      onNext={() => send({ type: 'next' })}
      onBack={() => send({ type: 'back' })}
      hasNext={!isFinish}
      nextReady={chapterDone(state)}
      nextLabel={state.chapter === LAST_CHAPTER - 1 ? t('tutorial.shell.finish') : t('tutorial.shell.next')}
      footer={isFinish ? (
        <>
          <button type="button" className="btn-secondary onb-back" onClick={() => { haptic(); onClose(); }}>
            {t('common.done')}
          </button>
          {onPlayGuided && (
            <button type="button" className="btn-primary onb-next onb-cta" onClick={() => { haptic(80); onPlayGuided(); }}>
              {t('tutorial.finish.playGuided')}
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
  dealt: { note: 'tutorial.goal.dealt.note', cta: 'tutorial.goal.dealt.cta' },
  peeked: { note: 'tutorial.goal.peeked.note', cta: 'tutorial.goal.peeked.cta' },
  'lost-one': { note: 'tutorial.goal.lostOne.note', cta: 'tutorial.goal.lostOne.cta' },
  out: { note: 'tutorial.goal.out.note', cta: 'tutorial.goal.out.cta' },
} as const;

function GoalChapter({ state, send }: ChapterProps) {
  const t = useT();
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
      title={t('tutorial.goal.title')}
      lede={t('tutorial.goal.lede', learnParams(t))}
      noteTone={step === 'out' ? 'danger' : step === 'lost-one' ? 'done' : 'info'}
      note={t(copy.note)}
      demo={(
        <Felt>
          <HandPlate influences={hand} coins={STARTING_COINS} out={step === 'out'} />
          <div className="onb-actions">
            <button
              type="button"
              className={step === 'out' ? 'btn-secondary' : 'btn-primary'}
              onClick={() => { (step === 'peeked' || step === 'lost-one') ? hapticHeavy() : haptic(); send({ type: 'goal/advance' }); }}
            >
              {t(copy.cta)}
            </button>
          </div>
        </Felt>
      )}
    />
  );
}

/* ── 2. Your turn ────────────────────────────────────────────────────── */

function TurnChapter({ state, send }: ChapterProps) {
  const t = useT();
  const p = learnParams(t);
  const { coins, last, refused } = state.turn;
  const general = TURN_ACTIONS.filter(a => a.claim === null);
  const character = TURN_ACTIONS.filter(a => a.claim !== null);
  const lastDef = last ? turnAction(last) : null;

  const note = !lastDef
    ? t('tutorial.turn.prompt')
    : refused
      ? t('tutorial.turn.refused', { action: actionName(t, lastDef.action), cost: -lastDef.delta, coins })
      : t(`tutorial.turn.result.${lastDef.id}`, p);

  /** The small line under each tile: what it pays, costs, or which character it claims. */
  const sub = (id: TurnActionId, delta: number, claim: Character | null): string => {
    if (claim) return characterName(t, claim);
    if (id === 'coup') return t('tutorial.turn.pay', { amount: -delta });
    return t('tutorial.turn.gain', { amount: delta });
  };

  return (
    <ChapterLayout
      title={t('tutorial.turn.title')}
      lede={t('tutorial.turn.lede', p)}
      noteTone={refused ? 'danger' : lastDef ? 'done' : 'info'}
      note={note}
      demo={(
        <div className="onb-dock prompt-action">
          <div className="onb-dock-head">
            <span className="onb-group-label">{t('tutorial.turn.anyone')}</span>
            <span className="court-hand-coins figure onb-purse" aria-label={t('tutorial.coins', { count: coins })}>
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
                  <span className="onb-tile-name type-display">{actionName(t, a.action)}</span>
                  <span className="onb-tile-sub">{sub(a.id, a.delta, a.claim)}</span>
                </span>
              </button>
            ))}
          </div>
          <span className="onb-group-label">{t('tutorial.turn.claimGroup')}</span>
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
                  <span className="onb-tile-name type-display">{actionName(t, a.action)}</span>
                  <span className="onb-tile-sub">{sub(a.id, a.delta, a.claim)}</span>
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
  const t = useT();
  const p = learnParams(t);
  const claimed = state.claims.claimed;
  return (
    <ChapterLayout
      title={t('tutorial.claims.title')}
      lede={t('tutorial.claims.lede', p)}
      noteTone={claimed ? 'done' : 'info'}
      note={claimed ? t('tutorial.claims.done', p) : t('tutorial.claims.prompt', p)}
      demo={(
        <Felt>
          <div className="onb-plaque-slot" aria-live="off">
            {claimed
              ? (
                <Plaque
                  actor={t('tutorial.you')}
                  headline={p.tax}
                  character={Character.Duke}
                  actionType={ActionType.Tax}
                  detail={t('tutorial.plaque.as', { character: p.duke })}
                />
              )
              : <span className="onb-plaque-ghost">{t('tutorial.tableGhost')}</span>}
          </div>
          <HandPlate influences={[shown(Character.Captain), shown(Character.Contessa)]} coins={claimed ? STARTING_COINS + TAX_COINS : STARTING_COINS} />
          <div className="onb-actions">
            {claimed ? (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); send({ type: 'claims/reset' }); }}>
                {t('tutorial.tryAgain')}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => { hapticHeavy(); send({ type: 'claims/claim' }); }}>
                <CharacterMedallion character={Character.Duke} size={26} />
                {t('tutorial.claims.button', p)}
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
  const t = useT();
  const p = learnParams(t);
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

  const say = (key: Parameters<typeof t.rich>[0]) => t.rich(key, { ...p, player: player(ALEX) });
  let note: ReactNode;
  let tone: 'info' | 'danger' | 'done' = 'info';
  if (stage === 'passed') {
    note = say('tutorial.challenge.passed');
  } else if (!revealed) {
    note = say(truthful ? 'tutorial.challenge.truthPrompt' : 'tutorial.challenge.bluffPrompt');
  } else if (!verdict) {
    note = say('tutorial.challenge.flipping');
  } else if (truthful) {
    note = say('tutorial.challenge.wasTrue');
    tone = 'danger';
  } else {
    note = say('tutorial.challenge.caughtBluff');
    tone = 'done';
  }

  return (
    <ChapterLayout
      title={t('tutorial.challenge.title')}
      lede={t('tutorial.challenge.lede', p)}
      noteTone={tone}
      note={note}
      demo={(
        <Felt>
          <div className="onb-row">
            <DemoSeat name={ALEX} influences={alexCards} coins={stage === 'passed' ? STARTING_COINS + TAX_COINS : STARTING_COINS} isTurn={!revealed} />
            <div className="onb-plaque-slot">
              <Plaque
                key={round}
                actor={ALEX}
                headline={p.tax}
                character={Character.Duke}
                actionType={ActionType.Tax}
                detail={t('tutorial.plaque.as', { character: p.duke })}
              />
            </div>
          </div>
          <div className="onb-actions">
            {stage === 'claim' && (
              <>
                <button type="button" className="btn-danger" onClick={() => { hapticHeavy(); send({ type: 'challenge/challenge' }); }}>
                  {t('tutorial.challenge.challenge')}
                </button>
                {!truthful && (
                  <button type="button" className="btn-secondary" onClick={() => { haptic(); send({ type: 'challenge/pass' }); }}>
                    {t('tutorial.challenge.letGo')}
                  </button>
                )}
              </>
            )}
            {stage === 'passed' && (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); send({ type: 'challenge/rewind' }); }}>
                {t('tutorial.tryAgain')}
              </button>
            )}
            {revealed && verdict && (
              <button
                type="button"
                className={truthful ? 'btn-secondary' : 'btn-primary'}
                onClick={() => { haptic(); send({ type: 'challenge/next-round' }); }}
              >
                {truthful ? t('tutorial.startOver') : t('tutorial.challenge.nextRound')}
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

function BlocksChapter({ state, send }: ChapterProps) {
  const t = useT();
  const p = learnParams(t);
  const { threat, blocked, miss } = state.blocks;
  const current = BLOCK_THREATS[threat];
  const correct = blockersFor(threat);
  const actionType = current.action;
  const blockedWith = blocked ? correct[0] : null;
  const [shakeKey, setShakeKey] = useState(0);
  const last = threat === BLOCK_THREATS.length - 1;
  const params = { ...p, player: player(ALEX) };

  // The last threat's result also says that a block can be challenged.
  const note = blocked
    ? t.rich(`tutorial.blocks.result.${actionType}`, params)
    : miss
      ? t('tutorial.blocks.miss', { character: characterName(t, miss), action: actionName(t, actionType) })
      : t.rich(`tutorial.blocks.ask.${actionType}`, params);

  return (
    <ChapterLayout
      title={t('tutorial.blocks.title')}
      lede={t('tutorial.blocks.lede', p)}
      noteTone={blocked ? 'done' : miss ? 'danger' : 'info'}
      note={note}
      demo={(
        <Felt>
          <div className="onb-threat-count">
            {t.rich('tutorial.blocks.count', { index: threat + 1, total: BLOCK_THREATS.length, fig })}
          </div>
          <div className="claim-stack onb-plaque-slot" key={threat}>
            <Plaque
              actor={ALEX}
              headline={actionName(t, actionType)}
              character={current.claim}
              actionType={actionType}
              blocked={blocked}
              detail={current.claim
                ? t(current.targeted ? 'tutorial.plaque.asOnYou' : 'tutorial.plaque.as', { character: characterName(t, current.claim) })
                : undefined}
            />
            {blockedWith && (
              <Plaque
                isBlock
                actor={t('tutorial.you')}
                headline={t('tutorial.plaque.blocks')}
                character={blockedWith}
                detail={t('tutorial.plaque.as', { character: characterName(t, blockedWith) })}
              />
            )}
          </div>
          {!blocked ? (
            <div className="onb-blockers" role="group" aria-label={t('tutorial.blocks.choices')}>
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
                      <span className="onb-blocker-name">{characterName(t, c)}</span>
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="onb-actions">
              <button type="button" className={last ? 'btn-secondary' : 'btn-primary'} onClick={() => { haptic(); send({ type: 'blocks/next' }); }}>
                {last ? t('tutorial.startOver') : t('tutorial.blocks.next')}
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
  const t = useT();
  const p = learnParams(t);
  const { coins, couped, refusal } = state.coins;
  const forced = mustCoup(coins);
  const ready = canCoup(coins);
  const slots = Math.max(FORCED_COUP_THRESHOLD, coins);

  const note: ReactNode = refusal === 'short'
    ? t('tutorial.coins.refusal.short', { ...p, short: COUP_COST - coins })
    : refusal === 'must-coup'
      ? t('tutorial.coins.refusal.must-coup', p)
      : couped
        ? t.rich('tutorial.coins.couped', { ...p, player: player(ALEX) })
        : forced
          ? t('tutorial.coins.forced', { ...p, coins })
          : ready
            ? t('tutorial.coins.ready', p)
            : t('tutorial.coins.collect', { ...p, coins });

  return (
    <ChapterLayout
      title={t('tutorial.coins.title', p)}
      lede={t('tutorial.coins.lede', p)}
      noteTone={refusal || forced ? 'danger' : couped ? 'done' : 'info'}
      note={note}
      demo={(
        <Felt>
          <DemoSeat
            name={ALEX}
            influences={couped ? [lost(Character.Ambassador), HIDDEN] : [HIDDEN, HIDDEN]}
            coins={3}
            isTarget={ready && !couped}
          />
          <div className="onb-meter" role="img" aria-label={t('tutorial.coins.meter', { ...p, coins })}>
            {Array.from({ length: slots }, (_, i) => (
              <span
                key={i}
                className={`onb-meter-slot ${i < coins ? 'is-full' : ''} ${i === COUP_COST - 1 ? 'is-coup' : ''} ${i === FORCED_COUP_THRESHOLD - 1 ? 'is-must' : ''}`}
              />
            ))}
            <span className="onb-meter-mark" style={{ ['--at' as string]: COUP_COST / slots }}>{t('tutorial.coins.markCoup', p)}</span>
            <span className="onb-meter-mark is-must" style={{ ['--at' as string]: FORCED_COUP_THRESHOLD / slots }}>{t('tutorial.coins.markMust', p)}</span>
          </div>
          <div className="onb-actions onb-actions-3">
            {couped ? (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); send({ type: 'coins/reset' }); }}>
                {t('tutorial.startOver')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  data-ineligible={forced ? 'true' : undefined}
                  aria-disabled={forced || undefined}
                  onClick={() => { haptic(); send({ type: 'coins/take', amount: INCOME_COINS }); }}
                >
                  {t('tutorial.coins.income', p)}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  data-ineligible={forced ? 'true' : undefined}
                  aria-disabled={forced || undefined}
                  onClick={() => { haptic(); send({ type: 'coins/take', amount: TAX_COINS }); }}
                >
                  {t('tutorial.coins.tax', p)}
                </button>
                <button
                  type="button"
                  className={ready ? 'btn-danger' : 'btn-secondary'}
                  data-ineligible={ready ? undefined : 'true'}
                  aria-disabled={!ready || undefined}
                  onClick={() => { ready ? hapticHeavy() : haptic(30); send({ type: 'coins/coup' }); }}
                >
                  <CoupGlyph size={18} /> {p.coup}
                </button>
              </>
            )}
          </div>
          <span className="onb-purse-line">
            {t.rich('tutorial.coins.purse', { coins, fig })}
          </span>
        </Felt>
      )}
    />
  );
}

/* ── Finish: the reference card ──────────────────────────────────────── */

const REFERENCE: Array<{ character: Character; reformation?: boolean }> = [
  { character: Character.Duke },
  { character: Character.Assassin },
  { character: Character.Captain },
  { character: Character.Ambassador },
  { character: Character.Contessa },
  { character: Character.Inquisitor, reformation: true },
];

function FinishChapter() {
  const t = useT();
  const p = learnParams(t);
  return (
    <>
      <div className="onb-text">
        <h3 className="onb-title type-display">{t('tutorial.finish.title')}</h3>
        <p className="onb-lede">{t('tutorial.finish.lede')}</p>
      </div>
      <ul className="onb-reference onb-demo" aria-label={t('tutorial.finish.list')}>
        {REFERENCE.map(r => (
          <li key={r.character} className="onb-ref">
            <CharacterMedallion character={r.character} size={40} />
            <span className="onb-ref-text">
              <span className="onb-ref-name type-display">{characterName(t, r.character)}</span>
              <span className="onb-ref-does">{t(`tutorial.ref.${r.character}.does`, p)}</span>
              <span className="onb-ref-blocks">
                {t(`tutorial.ref.${r.character}.blocks`, p)}
                {r.reformation ? <> · <i>{gameModeName(t, GameMode.Reformation)}</i></> : null}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="onb-note is-info">{t('tutorial.finish.general', p)}</p>
    </>
  );
}
