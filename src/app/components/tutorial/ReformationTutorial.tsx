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
const kicker = (n: number) => `Reformation · ${n + 1} of ${CHAPTERS.length} · ${CHAPTERS[n].label}`;

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
    ? 'Tutor Bot is a Reformist — a fair target for a Loyalist like you.'
    : aimed === 'morgan'
      ? 'Morgan is a Loyalist like you, so Morgan is off limits while both factions remain.'
      : 'You are a Loyalist (▲). Tap a seat you could Coup.';

  return (
    <ChapterLayout
      kicker={kicker(0)}
      title="Aim across faction lines"
      lede={<>Everyone is a <b>Loyalist ▲</b> or a <b>Reformist ◆</b>. Coup, Assassinate, Steal and Examine may only target the <b>other</b> faction — until every survivor shares one.</>}
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
      kicker={kicker(1)}
      title="Convert moves the lines"
      lede={<>Pay <b>1 coin</b> to switch your own faction, or <b>2</b> to switch someone else. It can't be challenged or blocked, and the coins go to the <b>Treasury Reserve</b>.</>}
      noteTone={converted ? 'done' : 'info'}
      note={converted
        ? 'You joined the Reformists and 1 coin went to the reserve. Everyone left shares a faction, so anyone may target anyone.'
        : 'A heads-up game: you against Tutor Bot.'}
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
              <button type="button" className="btn-secondary" onClick={() => { haptic(); onReset(); }}>Again</button>
            ) : (
              <button type="button" className="btn-primary" onClick={onConvert}>Pay 1 · Convert yourself</button>
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
      kicker={kicker(2)}
      title="Embezzle: a Duke claim, turned inside out"
      lede={<>Embezzle takes the whole reserve by claiming you do <b>not</b> hold a Duke. A challenger wins only if a Duke is found in your hand.</>}
      noteTone={resolved ? 'done' : 'info'}
      note={resolved
        ? 'Tutor Bot challenged — but there is no Duke in your hand. Tutor Bot loses a card, you shuffle in fresh cards, and the 4 coins are yours.'
        : 'Your hand: Captain and Inquisitor. No Duke.'}
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
            influences={resolved ? [HIDDEN, HIDDEN] : [shown(Character.Captain), shown(Character.Inquisitor)]}
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
    ? 'You hold the Inquisitor. Examine Tutor Bot.'
    : decision === null
      ? 'Tutor Bot chose to show you a Duke. Keep that knowledge, or force it out?'
      : decision === 'return'
        ? 'The Duke stays. Only you know Tutor Bot really has one.'
        : 'The Duke goes back to the deck and Tutor Bot draws blind. You shook their hand — but you no longer know it.';

  return (
    <ChapterLayout
      kicker={kicker(3)}
      title="The Inquisitor looks at a card"
      lede={<>Examine claims the Inquisitor. The target picks one of their cards to show you; then you <b>return it</b> or <b>force a swap</b>.</>}
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
              <button type="button" className="btn-secondary" onClick={() => { haptic(); onReset(); }}>Again</button>
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
    ['Factions', 'Target across faction lines, unless every survivor matches.'],
    ['Convert', 'Switch a faction for 1 or 2 coins; the coins feed the reserve.'],
    ['Embezzle', 'Claim you have no Duke and take the whole reserve.'],
    ['Examine', 'See one of a player’s cards, then return it or force a swap.'],
  ];

  return (
    <>
      <div className="onb-text">
        <p className="onb-kicker">Reformation · Ready</p>
        <h3 className="onb-title type-display">Same bluffing, new politics</h3>
        <p className="onb-lede">The expansion adds a map of loyalties. Everything else — claims, challenges, blocks — works exactly as before.</p>
      </div>
      <ol className="onb-recap onb-demo">
        {recap.map(([title, body], i) => (
          <li key={title} className="onb-ref">
            <span className="onb-recap-n figure" aria-hidden="true">{i + 1}</span>
            <span className="onb-ref-text">
              <span className="onb-ref-name type-display">{title}</span>
              <span className="onb-ref-does">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="onb-note is-info">Try it with coaching: Practice on the main menu → Reformation.</p>
    </>
  );
}
