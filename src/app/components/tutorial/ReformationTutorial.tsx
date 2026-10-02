'use client';

import { useEffect, useState } from 'react';
import { ActionType, Character, Faction } from '@/shared/types';
import { CoinGlyph } from '../icons';
import { Plaque } from '../game/table/ClaimPlaque';
import { PlayerSeat } from '../game/PlayerSeat';
import { OnboardingShell } from '../onboarding/OnboardingShell';
import { ChapterLayout, DemoSeat, Felt, HIDDEN, HandPlate, shown } from '../onboarding/parts';
import { haptic, hapticHeavy } from '../../utils/haptic';

interface ReformationTutorialProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The Reformation walkthrough: factions, Convert, Embezzle, Examine. Played on
 * the same stage and the same miniature table as "How Coup works", with the
 * real seats (and their ▲ LOY / ◆ REF marks) rather than coloured panels.
 */

const CHAPTERS = [
  { id: 'factions', label: 'Factions' },
  { id: 'convert', label: 'Convert' },
  { id: 'embezzle', label: 'Embezzle' },
  { id: 'examine', label: 'Examine' },
] as const;
const FINISH = CHAPTERS.length;

export function ReformationTutorial({ open, onClose }: ReformationTutorialProps) {
  const [step, setStep] = useState(0);
  const [aimed, setAimed] = useState<'morgan' | 'tutor' | null>(null);
  const [converted, setConverted] = useState(false);
  const [embezzled, setEmbezzled] = useState(false);
  const [examined, setExamined] = useState(false);
  const [examineDecision, setExamineDecision] = useState<'return' | 'swap' | null>(null);

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
      title="Reformation walkthrough"
      className="reformation-tutorial"
      chapters={CHAPTERS}
      index={step}
      onGoto={setStep}
      onNext={() => setStep(s => Math.min(FINISH, s + 1))}
      onBack={() => setStep(s => Math.max(0, s - 1))}
      hasNext={step < FINISH}
      nextReady={done}
      nextLabel={step === FINISH - 1 ? 'Finish' : 'Next'}
      footer={step === FINISH ? (
        <button type="button" className="btn-primary onb-next onb-cta" onClick={() => { haptic(80); onClose(); }}>
          Done
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
  const note = aimed === 'tutor'
    ? 'Tutor Bot is a Reformist, so you can target them.'
    : aimed === 'morgan'
      ? 'Morgan is a Loyalist like you, so you can\'t target Morgan.'
      : 'You\'re a Loyalist ▲. Tap a player you can target.';

  return (
    <ChapterLayout
      title="You can only target the other faction"
      lede="Everyone is a Loyalist ▲ or a Reformist ◆. Coup, Assassinate, Steal and Examine can only target the other faction. Once every player left is in one faction, anyone can target anyone."
      noteTone={aimed === 'tutor' ? 'done' : aimed === 'morgan' ? 'danger' : 'info'}
      note={note}
      demo={(
        <Felt>
          <div className="onb-row onb-row-seats">
            <div className="onb-seat">
              <PlayerSeat
                player={{ id: 'ref-morgan', name: 'Morgan', coins: 2, influences: [HIDDEN, HIDDEN], isAlive: true, seatIndex: 1, faction: Faction.Loyalist }}
                isCurrentTurn={false}
                isMe={false}
                cardPreview={false}
                illegalReason={aimed === 'morgan' ? 'Same faction' : undefined}
                onSelect={() => { haptic(30); onAim('morgan'); }}
              />
            </div>
            <div className="onb-seat">
              <PlayerSeat
                player={{ id: 'ref-tutor', name: 'Tutor Bot', coins: 2, influences: [HIDDEN, HIDDEN], isAlive: true, seatIndex: 2, faction: Faction.Reformist }}
                isCurrentTurn={false}
                isMe={false}
                cardPreview={false}
                isTarget={aimed === 'tutor'}
                selectable
                onSelect={() => { hapticHeavy(); onAim('tutor'); }}
              />
            </div>
          </div>
          <HandPlate influences={[shown(Character.Captain), shown(Character.Inquisitor)]} label="You · ▲ Loyalist" compact />
        </Felt>
      )}
    />
  );
}

function ConvertStep({ converted, onConvert, onReset }: { converted: boolean; onConvert: () => void; onReset: () => void }) {
  return (
    <ChapterLayout
      title="Convert switches a faction"
      lede="Pay 1 coin to switch your own faction or 2 to switch another player's. Nobody can challenge or block it. The coins go to the reserve."
      noteTone={converted ? 'done' : 'info'}
      note={converted
        ? 'You\'re a Reformist now. With everyone in one faction, anyone can target anyone.'
        : 'Two players left: you, a Loyalist, and Tutor Bot, a Reformist.'}
      demo={(
        <Felt>
          <div className="onb-row">
            <DemoSeat name="Tutor Bot" influences={[HIDDEN, HIDDEN]} coins={2} faction={Faction.Reformist} />
            <Reserve coins={converted ? 1 : 0} />
          </div>
          <HandPlate
            influences={[shown(Character.Captain), shown(Character.Duke)]}
            coins={converted ? 1 : 2}
            label={converted ? 'You · ◆ Reformist' : 'You · ▲ Loyalist'}
            compact
          />
          <div className="onb-actions">
            {converted ? (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); onReset(); }}>Start over</button>
            ) : (
              <button type="button" className="btn-primary" onClick={onConvert}>Convert yourself · 1 coin</button>
            )}
          </div>
        </Felt>
      )}
    />
  );
}

function EmbezzleStep({ resolved, onEmbezzle }: { resolved: boolean; onEmbezzle: () => void }) {
  return (
    <ChapterLayout
      title="Embezzle takes the whole reserve"
      lede="To Embezzle, you claim you don't have a Duke. A challenge works the other way round: the challenger wins only if you do have one."
      noteTone={resolved ? 'done' : 'info'}
      note={resolved
        ? 'Tutor Bot challenged and you had no Duke, so Tutor Bot loses a card. You draw two new cards and take the 4 coins.'
        : 'Your hand is a Captain and an Inquisitor. No Duke.'}
      demo={(
        <Felt>
          <div className="onb-row">
            <Reserve coins={resolved ? 0 : 4} />
            <div className="onb-plaque-slot">
              {resolved
                ? <Plaque actor="You" headline="Embezzle" actionType={ActionType.Embezzle} detail="claiming no Duke" />
                : <span className="onb-plaque-ghost">The table</span>}
            </div>
          </div>
          <HandPlate
            influences={resolved ? [shown(Character.Contessa), shown(Character.Assassin)] : [shown(Character.Captain), shown(Character.Inquisitor)]}
            coins={resolved ? 6 : 2}
            compact
          />
          {!resolved && (
            <div className="onb-actions">
              <button type="button" className="btn-primary" onClick={onEmbezzle}>Embezzle 4 coins</button>
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
  const note = !examined
    ? 'You have the Inquisitor. Examine Tutor Bot.'
    : decision === null
      ? 'Tutor Bot shows you a Duke. Return it or force a swap.'
      : decision === 'return'
        ? 'Tutor Bot keeps the Duke, and only you know about it.'
        : 'The Duke goes into the deck and Tutor Bot draws a new card. They lost the Duke, but now you don\'t know what they have.';

  return (
    <ChapterLayout
      title="Examine looks at one card"
      lede="Examine claims the Inquisitor. Your target picks one of their cards to show you. Then you return it, or make them swap it for a card from the deck."
      noteTone={decision ? 'done' : 'info'}
      note={note}
      demo={(
        <Felt>
          <DemoSeat
            name="Tutor Bot"
            influences={examined && decision !== 'swap' ? [shown(Character.Duke), HIDDEN] : [HIDDEN, HIDDEN]}
            coins={2}
            isTarget={examined && decision === null}
          />
          <div className="onb-actions">
            {!examined && (
              <button type="button" className="btn-primary" onClick={onExamine}>Examine Tutor Bot</button>
            )}
            {examined && decision === null && (
              <>
                <button type="button" className="btn-secondary" onClick={() => onDecide('return')}>Return it</button>
                <button type="button" className="btn-primary" onClick={() => onDecide('swap')}>Force swap</button>
              </>
            )}
            {decision && (
              <button type="button" className="btn-secondary" onClick={() => { haptic(); onReset(); }}>Start over</button>
            )}
          </div>
          <HandPlate influences={[shown(Character.Inquisitor), shown(Character.Contessa)]} compact />
        </Felt>
      )}
    />
  );
}

function Reserve({ coins }: { coins: number }) {
  return (
    <div className="onb-reserve" aria-label={`Treasury Reserve: ${coins} coins`}>
      <span className="onb-reserve-label">Reserve</span>
      <span className="onb-reserve-coins figure"><CoinGlyph size={18} /> {coins}</span>
    </div>
  );
}

function ReadyStep() {
  const recap = [
    ['Factions', 'Target the other faction until everyone left is in one.'],
    ['Convert', 'Pay 1 to switch your faction or 2 to switch someone else\'s. The coins go to the reserve.'],
    ['Embezzle', 'Claim you have no Duke and take the whole reserve.'],
    ['Examine', 'See one of a player\'s cards, then return it or force a swap.'],
  ];

  return (
    <>
      <div className="onb-text">
        <h3 className="onb-title type-display">What Reformation changes</h3>
        <p className="onb-lede">Claims, challenges and blocks work the same as in the base game.</p>
      </div>
      <ul className="onb-recap onb-demo">
        {recap.map(([title, body]) => (
          <li key={title} className="onb-ref">
            <span className="onb-ref-text">
              <span className="onb-ref-name type-display">{title}</span>
              <span className="onb-ref-does">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="onb-note is-info">To play it with tips, open Practice on the main menu and pick Reformation.</p>
    </>
  );
}
