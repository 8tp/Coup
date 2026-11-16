'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActionType, Character, Faction } from '@/shared/types';
import { CONVERSION_SELF_COST, STARTING_COINS } from '@/shared/constants';
import { useT, actionName } from '../../i18n';
import { CoinGlyph } from '../icons';
import { Plaque } from '../game/table/ClaimPlaque';
import { PlayerSeat } from '../game/PlayerSeat';
import { OnboardingShell } from '../onboarding/OnboardingShell';
import { ChapterLayout, DemoSeat, Felt, HIDDEN, HandPlate, shown } from '../onboarding/parts';
import { haptic, hapticHeavy } from '../../utils/haptic';
import { learnParams } from '../../utils/learnText';

interface ReformationTutorialProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The Reformation walkthrough: factions, Convert, Embezzle, Examine. Played on
 * the same stage and the same miniature table as "How Coup works", with the
 * real seats (and their ▲ LOY / ◆ REF marks) rather than coloured panels.
 * Every word is a `tutorial.reform.*` message.
 */

const CHAPTERS = ['factions', 'convert', 'embezzle', 'examine'] as const;
const FINISH = CHAPTERS.length;

/** The demonstration's players: names, never translated. */
const MORGAN = 'Morgan';
const TUTOR = 'Tutor Bot';
/** The reserve the Embezzle demonstration takes. */
const RESERVE_DEMO = 4;

/** `{player}` in a sentence: a name, isolated for right-to-left text. */
const player = (name: string) => <bdi>{name}</bdi>;

export function ReformationTutorial({ open, onClose }: ReformationTutorialProps) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [aimed, setAimed] = useState<'morgan' | 'tutor' | null>(null);
  const [converted, setConverted] = useState(false);
  const [embezzled, setEmbezzled] = useState(false);
  const [examined, setExamined] = useState(false);
  const [examineDecision, setExamineDecision] = useState<'return' | 'swap' | null>(null);
  const chapters = useMemo(() => [
    { id: 'factions', label: t('tutorial.reform.chapter.factions') },
    { id: 'convert', label: actionName(t, ActionType.Convert) },
    { id: 'embezzle', label: actionName(t, ActionType.Embezzle) },
    { id: 'examine', label: actionName(t, ActionType.Examine) },
  ] satisfies Array<{ id: typeof CHAPTERS[number]; label: string }>, [t]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setAimed(null);
    setConverted(false);
    setEmbezzled(false);
    setExamined(false);
    setExamineDecision(null);
  }, [open]);

  const done = step === 0 ? aimed === 'tutor'
    : step === 1 ? converted
      : step === 2 ? embezzled
        : step === 3 ? examineDecision !== null
          : true;

  return (
    <OnboardingShell
      open={open}
      onClose={onClose}
      title={t('tutorial.reform.title', learnParams(t))}
      className="reformation-tutorial"
      chapters={chapters}
      index={step}
      onGoto={setStep}
      onNext={() => setStep(s => Math.min(FINISH, s + 1))}
      onBack={() => setStep(s => Math.max(0, s - 1))}
      hasNext={step < FINISH}
      nextReady={done}
      nextLabel={step === FINISH - 1 ? t('tutorial.shell.finish') : t('tutorial.shell.next')}
      footer={step === FINISH ? (
        <button type="button" className="btn-primary onb-next onb-cta" onClick={() => { haptic(80); onClose(); }}>
          {t('common.done')}
        </button>
      ) : undefined}
    >
      {step === 0 && <FactionsStep aimed={aimed} onAim={setAimed} />}
      {step === 1 && <ConvertStep converted={converted} onConvert={() => { hapticHeavy(); setConverted(true); }} onReset={() => setConverted(false)} />}
      {step === 2 && <EmbezzleStep resolved={embezzled} onEmbezzle={() => { hapticHeavy(); setEmbezzled(true); }} />}
      {step === 3 && (
        <ExamineStep
          examined={examined}
          decision={examineDecision}
          onExamine={() => { hapticHeavy(); setExamined(true); }}
          onDecide={(decision) => { hapticHeavy(); setExamineDecision(decision); }}
          onReset={() => { setExamined(false); setExamineDecision(null); }}
        />
      )}
      {step === FINISH && <ReadyStep />}
    </OnboardingShell>
  );
}

function FactionsStep({ aimed, onAim }: { aimed: 'morgan' | 'tutor' | null; onAim: (who: 'morgan' | 'tutor') => void }) {
  const t = useT();
  const p = learnParams(t);
  const note = aimed === 'tutor'
    ? t.rich('tutorial.reform.factions.right', { ...p, player: player(TUTOR) })
    : aimed === 'morgan'
      ? t.rich('tutorial.reform.factions.wrong', { ...p, player: player(MORGAN) })
      : t('tutorial.reform.factions.prompt', p);

  return (
    <ChapterLayout
      title={t('tutorial.reform.factions.title')}
      lede={t('tutorial.reform.factions.lede', p)}
      noteTone={aimed === 'tutor' ? 'done' : aimed === 'morgan' ? 'danger' : 'info'}
      note={note}
      demo={(
        <Felt>
          <div className="onb-row onb-row-seats">
            <div className="onb-seat">
              <PlayerSeat
                player={{ id: 'ref-morgan', name: MORGAN, coins: STARTING_COINS, influences: [HIDDEN, HIDDEN], isAlive: true, seatIndex: 1, faction: Faction.Loyalist }}
                isCurrentTurn={false}
                isMe={false}
                cardPreview={false}
                illegalReason={aimed === 'morgan' ? t('tutorial.reform.factions.sameFaction') : undefined}
                onSelect={() => { haptic(30); onAim('morgan'); }}
              />
            </div>
            <div className="onb-seat">
              <PlayerSeat
                player={{ id: 'ref-tutor', name: TUTOR, coins: STARTING_COINS, influences: [HIDDEN, HIDDEN], isAlive: true, seatIndex: 2, faction: Faction.Reformist }}
                isCurrentTurn={false}
                isMe={false}
                cardPreview={false}
                isTarget={aimed === 'tutor'}
                selectable
                onSelect={() => { hapticHeavy(); onAim('tutor'); }}
              />
            </div>
          </div>
          <HandPlate influences={[shown(Character.Captain), shown(Character.Inquisitor)]} label={t('tutorial.youLoyalist', p)} compact />
        </Felt>
      )}
    />
  );
}

function ConvertStep({ converted, onConvert, onReset }: { converted: boolean; onConvert: () => void; onReset: () => void }) {
  const t = useT();
  const p = learnParams(t);
  return (
    <ChapterLayout
      title={t('tutorial.reform.convert.title', p)}
      lede={t('tutorial.reform.convert.lede', p)}
      noteTone={converted ? 'done' : 'info'}
      note={converted
        ? t('tutorial.reform.convert.done', p)
        : t.rich('tutorial.reform.convert.prompt', { ...p, player: player(TUTOR) })}
      demo={(
        <Felt>
          <div className="onb-row">
            <DemoSeat name={TUTOR} influences={[HIDDEN, HIDDEN]} coins={STARTING_COINS} faction={Faction.Reformist} />
            <Reserve coins={converted ? CONVERSION_SELF_COST : 0} />
          </div>
          <HandPlate
            influences={[shown(Character.Captain), shown(Character.Duke)]}
            coins={converted ? STARTING_COINS - CONVERSION_SELF_COST : STARTING_COINS}
            label={converted ? t('tutorial.youReformist', p) : t('tutorial.youLoyalist', p)}
            compact
          />
          <div className="onb-actions">
            {converted ? (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); onReset(); }}>{t('tutorial.startOver')}</button>
            ) : (
              <button type="button" className="btn-primary" onClick={onConvert}>{t('tutorial.reform.convert.button', p)}</button>
            )}
          </div>
        </Felt>
      )}
    />
  );
}

function EmbezzleStep({ resolved, onEmbezzle }: { resolved: boolean; onEmbezzle: () => void }) {
  const t = useT();
  const p = learnParams(t);
  return (
    <ChapterLayout
      title={t('tutorial.reform.embezzle.title', p)}
      lede={t('tutorial.reform.embezzle.lede', p)}
      noteTone={resolved ? 'done' : 'info'}
      note={resolved
        ? t.rich('tutorial.reform.embezzle.done', { ...p, player: player(TUTOR), coins: RESERVE_DEMO })
        : t('tutorial.reform.embezzle.prompt', p)}
      demo={(
        <Felt>
          <div className="onb-row">
            <Reserve coins={resolved ? 0 : RESERVE_DEMO} />
            <div className="onb-plaque-slot">
              {resolved
                ? <Plaque actor={t('tutorial.you')} headline={p.embezzle} actionType={ActionType.Embezzle} detail={t('tutorial.plaque.noDuke', p)} />
                : <span className="onb-plaque-ghost">{t('tutorial.tableGhost')}</span>}
            </div>
          </div>
          <HandPlate
            influences={resolved ? [shown(Character.Contessa), shown(Character.Assassin)] : [shown(Character.Captain), shown(Character.Inquisitor)]}
            coins={resolved ? STARTING_COINS + RESERVE_DEMO : STARTING_COINS}
            compact
          />
          {!resolved && (
            <div className="onb-actions">
              <button type="button" className="btn-primary" onClick={onEmbezzle}>
                {t('tutorial.reform.embezzle.button', { ...p, coins: RESERVE_DEMO })}
              </button>
            </div>
          )}
        </Felt>
      )}
    />
  );
}

function ExamineStep({
  examined,
  decision,
  onExamine,
  onDecide,
  onReset,
}: {
  examined: boolean;
  decision: 'return' | 'swap' | null;
  onExamine: () => void;
  onDecide: (decision: 'return' | 'swap') => void;
  onReset: () => void;
}) {
  const t = useT();
  const p = learnParams(t);
  const params = { ...p, player: player(TUTOR) };
  const note = !examined
    ? t.rich('tutorial.reform.examine.prompt', params)
    : decision === null
      ? t.rich('tutorial.reform.examine.shown', params)
      : decision === 'return'
        ? t.rich('tutorial.reform.examine.returned', params)
        : t.rich('tutorial.reform.examine.swapped', params);

  return (
    <ChapterLayout
      title={t('tutorial.reform.examine.title', p)}
      lede={t('tutorial.reform.examine.lede', p)}
      noteTone={decision ? 'done' : 'info'}
      note={note}
      demo={(
        <Felt>
          <DemoSeat
            name={TUTOR}
            influences={examined && decision !== 'swap' ? [shown(Character.Duke), HIDDEN] : [HIDDEN, HIDDEN]}
            coins={STARTING_COINS}
            isTarget={examined && decision === null}
          />
          <div className="onb-actions">
            {!examined && (
              <button type="button" className="btn-primary" onClick={onExamine}><span>{t.rich('tutorial.reform.examine.button', params)}</span></button>
            )}
            {examined && decision === null && (
              <>
                <button type="button" className="btn-secondary" onClick={() => onDecide('return')}>{t('tutorial.reform.examine.return')}</button>
                <button type="button" className="btn-primary" onClick={() => onDecide('swap')}>{t('tutorial.reform.examine.swap')}</button>
              </>
            )}
            {decision && (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); onReset(); }}>{t('tutorial.startOver')}</button>
            )}
          </div>
          <HandPlate influences={[shown(Character.Inquisitor), shown(Character.Contessa)]} compact />
        </Felt>
      )}
    />
  );
}

function Reserve({ coins }: { coins: number }) {
  const t = useT();
  return (
    <div className="onb-reserve" aria-label={t('tutorial.reform.reserveLabel', { reserve: t('glossary.term.reserve'), coins })}>
      <span className="onb-reserve-label">{t('tutorial.reform.reserve')}</span>
      <span className="onb-reserve-coins figure"><CoinGlyph size={18} /> {coins}</span>
    </div>
  );
}

function ReadyStep() {
  const t = useT();
  const p = learnParams(t);
  const recap = [
    { id: 'factions', title: t('tutorial.reform.chapter.factions'), body: t('tutorial.reform.recap.factions', p) },
    { id: 'convert', title: p.convert, body: t('tutorial.reform.recap.convert', p) },
    { id: 'embezzle', title: p.embezzle, body: t('tutorial.reform.recap.embezzle', p) },
    { id: 'examine', title: p.examine, body: t('tutorial.reform.recap.examine', p) },
  ];

  return (
    <>
      <div className="onb-text">
        <h3 className="onb-title type-display">{t('tutorial.reform.recap.title', p)}</h3>
        <p className="onb-lede">{t('tutorial.reform.recap.lede')}</p>
      </div>
      <ul className="onb-recap onb-demo">
        {recap.map(({ id, title, body }) => (
          <li key={id} className="onb-ref">
            <span className="onb-ref-text">
              <span className="onb-ref-name type-display">{title}</span>
              <span className="onb-ref-does">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="onb-note is-info">{t('tutorial.reform.recap.practice', p)}</p>
    </>
  );
}
