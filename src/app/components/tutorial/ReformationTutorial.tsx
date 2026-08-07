'use client';

import { useEffect, useRef, useState } from 'react';
import { Character } from '@/shared/types';
import { CoinIcon } from '../icons';
import { CardArtwork, CardBackArtwork, CharacterCardBadge } from '../game/CardArtwork';
import { haptic, hapticHeavy } from '../../utils/haptic';

interface ReformationTutorialProps {
  open: boolean;
  onClose: () => void;
}

const STEP_LABELS = ['Factions', 'Convert', 'Embezzle', 'Examine', 'Ready'] as const;

function FactionBadge({ faction }: { faction: 'Loyalist' | 'Reformist' }) {
  const loyalist = faction === 'Loyalist';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
      loyalist
        ? 'border-blue-500/50 bg-blue-950/60 text-blue-300'
        : 'border-red-500/50 bg-red-950/60 text-red-300'
    }`}>
      {loyalist ? '▲ LOY' : '◆ REF'}
    </span>
  );
}

function MiniCard({ character, hidden = false }: { character: Character; hidden?: boolean }) {
  return (
    <div className="relative h-20 w-14 overflow-hidden rounded-lg border-2 border-teal-500/60 bg-coup-card shadow-lg">
      {hidden ? (
        <CardBackArtwork variant="focus" />
      ) : (
        <>
          <CardArtwork character={character} variant="focus" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/15" />
          <CharacterCardBadge character={character} />
        </>
      )}
    </div>
  );
}

export function ReformationTutorial({ open, onClose }: ReformationTutorialProps) {
  const [step, setStep] = useState(0);
  const [converted, setConverted] = useState(false);
  const [embezzled, setEmbezzled] = useState(false);
  const [examined, setExamined] = useState(false);
  const [examineDecision, setExamineDecision] = useState<'return' | 'swap' | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setConverted(false);
    setEmbezzled(false);
    setExamined(false);
    setExamineDecision(null);
  }, [open]);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const canContinue = step === 0
    || (step === 1 && converted)
    || (step === 2 && embezzled)
    || (step === 3 && examineDecision !== null)
    || step === STEP_LABELS.length - 1;

  const goTo = (nextStep: number) => {
    haptic();
    setStep(Math.max(0, Math.min(STEP_LABELS.length - 1, nextStep)));
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-coup-bg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reformation-tutorial-title"
    >
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <div
          className="flex flex-1 gap-1"
          role="progressbar"
          aria-label={`Step ${step + 1} of ${STEP_LABELS.length}: ${STEP_LABELS[step]}`}
          aria-valuemin={1}
          aria-valuemax={STEP_LABELS.length}
          aria-valuenow={step + 1}
        >
          {STEP_LABELS.map((label, index) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                index <= step ? 'bg-teal-400' : 'bg-gray-800'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
        <button
          type="button"
          className="shrink-0 text-sm font-medium text-gray-500 transition hover:text-white"
          onClick={() => { haptic(); onClose(); }}
        >
          Close
        </button>
      </div>

      <main className="grid flex-1 justify-items-center overflow-y-auto px-5 py-3">
        <div key={step} className="my-auto w-full max-w-md animate-fade-in">
          <p className="mb-1 text-center text-[10px] font-black uppercase tracking-[0.2em] text-teal-400">
            Reformation · {STEP_LABELS[step]}
          </p>
          <h2
            id="reformation-tutorial-title"
            ref={headingRef}
            tabIndex={-1}
            className="sr-only"
          >
            Reformation guided walkthrough
          </h2>

          {step === 0 && <FactionsStep />}
          {step === 1 && <ConvertStep converted={converted} onConvert={() => { hapticHeavy(); setConverted(true); }} />}
          {step === 2 && <EmbezzleStep resolved={embezzled} onEmbezzle={() => { hapticHeavy(); setEmbezzled(true); }} />}
          {step === 3 && (
            <ExamineStep
              examined={examined}
              decision={examineDecision}
              onExamine={() => { hapticHeavy(); setExamined(true); }}
              onDecide={(decision) => { hapticHeavy(); setExamineDecision(decision); }}
            />
          )}
          {step === 4 && <ReadyStep />}
        </div>
      </main>

      <div className="mx-auto flex w-full max-w-md gap-3 px-5 pb-6 pt-2">
        {step > 0 && (
          <button type="button" className="btn-secondary flex-1" onClick={() => goTo(step - 1)}>
            Back
          </button>
        )}
        {step < STEP_LABELS.length - 1 ? (
          <button
            type="button"
            className={`${step === 0 ? 'w-full' : 'flex-1'} rounded-xl bg-teal-500 px-4 py-3 font-bold text-gray-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-40`}
            onClick={() => goTo(step + 1)}
            disabled={!canContinue}
          >
            {step === 0 ? 'Start Scenario' : canContinue ? 'Next' : 'Try the action above'}
          </button>
        ) : (
          <button
            type="button"
            className="flex-1 rounded-xl bg-teal-500 px-4 py-3 font-bold text-gray-950 transition hover:bg-teal-400"
            onClick={() => { haptic(80); onClose(); }}
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}

function FactionsStep() {
  return (
    <div className="text-center">
      <h3 className="mb-2 text-2xl font-bold text-white">Read the table by faction</h3>
      <p className="mb-6 text-sm text-gray-400">
        Targeted actions normally cross faction lines. Challenges and blocks still ignore factions.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-blue-500/50 bg-blue-950/30 p-3">
          <div className="mb-2 text-xl" aria-hidden="true">♟</div>
          <p className="text-xs font-bold text-white">You</p>
          <FactionBadge faction="Loyalist" />
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 opacity-60">
          <div className="mb-2 text-xl" aria-hidden="true">♟</div>
          <p className="text-xs font-bold text-white">Morgan</p>
          <FactionBadge faction="Loyalist" />
          <p className="mt-2 text-[10px] font-bold text-blue-300">Protected from you</p>
        </div>
        <div className="rounded-xl border border-red-500/60 bg-red-950/30 p-3 ring-1 ring-red-400/30">
          <div className="mb-2 text-xl" aria-hidden="true">♟</div>
          <p className="text-xs font-bold text-white">Tutor Bot</p>
          <FactionBadge faction="Reformist" />
          <p className="mt-2 text-[10px] font-bold text-red-300">Valid target</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-gray-700 bg-coup-card/60 p-3 text-left text-xs text-gray-400">
        <span className="font-bold text-white">Coup, Assassinate, Steal, and Examine</span> follow faction targeting.
        When every survivor shares one faction, the restriction lifts.
      </div>
    </div>
  );
}

function ConvertStep({ converted, onConvert }: { converted: boolean; onConvert: () => void }) {
  return (
    <div className="text-center">
      <h3 className="mb-2 text-2xl font-bold text-white">Convert changes the map</h3>
      <p className="mb-5 text-sm text-gray-400">
        Pay 1 coin to switch yourself or 2 to switch someone else. Those coins seed the Treasury Reserve.
      </p>

      <div className="rounded-xl border border-gray-700 bg-coup-card/60 p-4">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-gray-500">Heads-up example</p>
        <div className="flex items-center justify-between">
          <div className="text-left">
            <p className="font-bold text-white">You</p>
            <FactionBadge faction={converted ? 'Reformist' : 'Loyalist'} />
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Reserve</p>
            <div className="mt-1 flex items-center justify-center gap-1 font-bold text-coup-accent">
              <CoinIcon size={16} /> {converted ? 1 : 0}
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-white">Tutor Bot</p>
            <FactionBadge faction="Reformist" />
          </div>
        </div>

        {!converted ? (
          <button
            type="button"
            className="mt-5 w-full rounded-xl border-2 border-blue-500 bg-blue-950/50 py-3 text-sm font-bold text-blue-200 transition hover:bg-blue-900/60"
            onClick={onConvert}
          >
            Pay 1 coin · Convert yourself
          </button>
        ) : (
          <div className="mt-5 rounded-lg border border-teal-500/40 bg-teal-950/40 p-3 text-sm text-teal-200 animate-fade-in">
            You joined the Reformists and placed 1 coin in reserve. With every survivor now on one faction,
            targeting becomes free-for-all again.
          </div>
        )}
      </div>
    </div>
  );
}

function EmbezzleStep({ resolved, onEmbezzle }: { resolved: boolean; onEmbezzle: () => void }) {
  return (
    <div className="text-center">
      <h3 className="mb-2 text-2xl font-bold text-white">Embezzle reverses the bluff</h3>
      <p className="mb-5 text-sm text-gray-400">
        Embezzle claims you do <span className="font-bold text-white">not</span> hold Duke. A challenger wins only if a Duke is found in your hand.
      </p>

      <div className="rounded-xl border border-coup-accent/30 bg-coup-card/60 p-4">
        <div className="mb-4 flex items-center justify-center gap-2 text-coup-accent">
          <span className="text-xs font-black uppercase tracking-wider">Treasury Reserve</span>
          <CoinIcon size={18} />
          <span className="text-xl font-black">{resolved ? 0 : 4}</span>
        </div>

        <div className="mb-4 flex justify-center gap-3">
          <MiniCard character={Character.Captain} />
          <MiniCard character={Character.Inquisitor} />
        </div>

        {!resolved ? (
          <button
            type="button"
            className="w-full rounded-xl border-2 border-coup-accent bg-amber-950/50 py-3 text-sm font-bold text-coup-accent transition hover:bg-amber-900/60"
            onClick={onEmbezzle}
          >
            Embezzle 4 coins
          </button>
        ) : (
          <div className="rounded-lg border border-green-500/40 bg-green-950/40 p-3 text-sm text-green-200 animate-fade-in">
            Tutor Bot challenged, but your hand has no Duke. The challenge fails and you collect all 4 reserve coins.
          </div>
        )}
      </div>
    </div>
  );
}

function ExamineStep({
  examined,
  decision,
  onExamine,
  onDecide,
}: {
  examined: boolean;
  decision: 'return' | 'swap' | null;
  onExamine: () => void;
  onDecide: (decision: 'return' | 'swap') => void;
}) {
  return (
    <div className="text-center">
      <h3 className="mb-2 text-2xl font-bold text-white">Inquisitor turns information into pressure</h3>
      <p className="mb-5 text-sm text-gray-400">
        Examine claims Inquisitor. After challenges resolve, inspect one hidden card and decide what happens to it.
      </p>

      <div className="rounded-xl border border-teal-500/40 bg-teal-950/20 p-4">
        <div className="mb-4 flex items-center justify-center gap-4">
          <MiniCard character={Character.Inquisitor} />
          <span className="text-2xl text-teal-400">→</span>
          <div className={examined ? 'animate-fade-in' : ''}>
            <MiniCard character={Character.Duke} hidden={!examined || decision === 'swap'} />
          </div>
        </div>

        {!examined ? (
          <button
            type="button"
            className="w-full rounded-xl border-2 border-teal-500 bg-teal-950/60 py-3 text-sm font-bold text-teal-200 transition hover:bg-teal-900/60"
            onClick={onExamine}
          >
            Examine Tutor Bot
          </button>
        ) : decision === null ? (
          <div className="animate-fade-in">
            <p className="mb-3 text-sm text-gray-300">You found a Duke. Keep that information or disrupt the hand?</p>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => onDecide('return')}>
                Return it
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-teal-500 px-3 py-2.5 text-sm font-bold text-gray-950"
                onClick={() => onDecide('swap')}
              >
                Force swap
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-teal-500/40 bg-teal-950/50 p-3 text-sm text-teal-200 animate-fade-in">
            {decision === 'return'
              ? 'The Duke stays. Only you know their claim is now more believable.'
              : 'The Duke returns to the deck and the replacement stays hidden. You disrupted the hand but gave up certainty.'}
          </div>
        )}
      </div>
    </div>
  );
}

function ReadyStep() {
  const recap = [
    ['1', 'Read factions', 'Target across faction lines unless every survivor matches.'],
    ['2', 'Convert', 'Move players and feed coins into the reserve.'],
    ['3', 'Embezzle', 'Claim you do not hold Duke and take the whole reserve.'],
    ['4', 'Examine', 'Inspect a card, then preserve the read or force a swap.'],
  ];

  return (
    <div className="text-center">
      <h3 className="mb-2 text-2xl font-bold text-white">You&apos;re ready for Reformation</h3>
      <p className="mb-5 text-sm text-gray-400">The expansion adds a political map, but Coup&apos;s bluffing core stays the same.</p>

      <div className="space-y-2 text-left">
        {recap.map(([number, title, body], index) => (
          <div
            key={title}
            className="flex gap-3 rounded-xl border border-gray-700 bg-coup-card/60 p-3"
            style={{ animation: `fadeIn 0.3s ease-out ${index * 0.08}s both` }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500 text-xs font-black text-gray-950">{number}</span>
            <div>
              <p className="text-sm font-bold text-white">{title}</p>
              <p className="text-xs text-gray-400">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-gray-500">
        Open Settings from the main menu and choose <span className="font-bold text-teal-300">Reformation · Guided Bot Game</span> to practice with contextual tips.
      </p>
    </div>
  );
}
