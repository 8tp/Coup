'use client';

import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { ActionType, Character, GameMode } from '@/shared/types';
import { ASSASSINATE_COST, COUP_COST } from '@/shared/constants';
import { useT, characterName, actionName, gameModeName, type Translator } from '../../i18n';
import { Modal } from '../ui/Modal';
import { haptic } from '../../utils/haptic';
import { CHARACTER_PALETTE, characterCardVars } from '../../utils/characterPalette';
import { FOREIGN_AID_COINS, INCOME_COINS, TAX_COINS, learnParams } from '../../utils/learnText';
import { CardArtwork, CharacterCardBadge } from '../game/CardArtwork';
import { ReformationTutorial } from '../tutorial/ReformationTutorial';

/**
 * How to Play: the rules reference. Every sentence is a `rules.*` message;
 * game nouns and rule numbers come in as params (utils/learnText.ts), so the
 * reference names things exactly as the table, the log and the tutorial do.
 */

const tabs = ['overview', 'characters', 'rules', 'reformation'] as const;
type Tab = typeof tabs[number];

function tabLabel(t: Translator, tab: Tab): string {
  switch (tab) {
    case 'overview': return t('rules.tab.overview');
    case 'characters': return t('rules.tab.characters');
    case 'rules': return t('rules.tab.rules');
    case 'reformation': return gameModeName(t, GameMode.Reformation);
  }
}

/** `<term>` and `<name>` in rules messages: a rules word set in white. */
const term = (chunks: ReactNode) => <span className="text-white font-medium">{chunks}</span>;
/** `<inq>`: the Inquisitor's teal. */
const inq = (chunks: ReactNode) => <span className="text-teal-300 font-medium">{chunks}</span>;

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showReformationTutorial, setShowReformationTutorial] = useState(false);
  const walkthroughTriggerRef = useRef<HTMLButtonElement>(null);

  const closeReformationTutorial = () => {
    setShowReformationTutorial(false);
    requestAnimationFrame(() => walkthroughTriggerRef.current?.focus());
  };

  return (
    <>
      <Modal open={open && !showReformationTutorial} onClose={onClose} maxWidth="max-w-2xl" scrollable>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t('rules.title')}</h2>
          <button
            className="court-icon-btn text-2xl leading-none"
            onClick={() => { haptic(); onClose(); }}
            aria-label={t('common.close')}
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab}
              className="how-to-play-tab"
              data-active={activeTab === tab ? 'true' : 'false'}
              onClick={() => { haptic(); setActiveTab(tab); }}
            >
              {tabLabel(t, tab)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'characters' && <CharactersTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'reformation' && (
          <ReformationTab
            walkthroughTriggerRef={walkthroughTriggerRef}
            onOpenWalkthrough={() => setShowReformationTutorial(true)}
          />
        )}
      </Modal>
      <ReformationTutorial
        open={showReformationTutorial}
        onClose={closeReformationTutorial}
      />
    </>
  );
}

function OverviewTab() {
  const t = useT();
  const p = learnParams(t);
  return (
    <div className="space-y-4 text-sm text-gray-300">
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.overview.whatIsHeading')}</h3>
        <p>{t('rules.overview.whatIs', p)}</p>
      </div>
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.overview.goalHeading')}</h3>
        <p>{t('rules.overview.goal', p)}</p>
      </div>
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.overview.flowHeading')}</h3>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>{t('rules.overview.flow1', p)}</li>
          <li>{t.rich('rules.overview.flow2', { ...p, term })}</li>
          <li>{t.rich('rules.overview.flow3', { ...p, term })}</li>
          <li>{t('rules.overview.flow4', p)}</li>
        </ol>
      </div>
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.overview.bluffHeading')}</h3>
        <p className="text-gray-400">{t('rules.overview.bluff', p)}</p>
      </div>
      <div className="border-t border-coup-line/70 pt-4 mt-2">
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.overview.creditsHeading')}</h3>
        <p>
          {t.rich('rules.overview.credits', {
            designer: 'Rikki Tahta',
            publisher1: 'La Mame Games',
            publisher2: 'Indie Boards & Cards',
            term,
            link: (chunks: ReactNode) => (
              <a
                href="https://www.amazon.com/Indie-Boards-and-Cards-COU1IBC/dp/B00GDI4HX4"
                target="_blank"
                rel="noopener noreferrer"
                className="text-coup-accent underline hover:text-white"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </div>
  );
}

function CharactersTab() {
  const t = useT();
  const p = learnParams(t);
  const characters = Object.values(Character);

  return (
    <div className="grid gap-3">
      {characters.map(char => {
        const theme = CHARACTER_PALETTE[char];
        return (
          <div
            key={char}
            className={`flex items-center gap-3 p-3 rounded border ${theme.tint} ${theme.edge}`}
          >
            {/* A real card frame, so the roster teaches the same band the
                table uses (ART-DIRECTION §1.2). */}
            <div className="card-face h-14 w-10 shrink-0" style={characterCardVars(char)}>
              <CardArtwork character={char} variant="focus" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
              <CharacterCardBadge character={char} />
            </div>
            <div>
              <div className={`font-bold ${theme.text}`}>{characterName(t, char)}</div>
              <div className="text-sm text-coup-ink-mute">{t(`rules.character.${char}`, p)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** An empty cell in the actions table. */
const DASH = <>&mdash;</>;

function RulesTab() {
  const t = useT();
  const p = learnParams(t);
  const action = (a: ActionType) => actionName(t, a);
  const character = (c: Character) => characterName(t, c);
  const gain = (amount: number) => t('rules.effect.gain', { amount });
  return (
    <div className="space-y-5 text-sm">
      {/* Actions table */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-3">{t('rules.actionsHeading')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-gray-300">
            <thead>
              <tr className="border-b border-coup-line/70 text-xs text-coup-ink-mute uppercase">
                <th className="py-2 pe-3">{t('rules.table.action')}</th>
                <th className="py-2 pe-3">{t('rules.table.cost')}</th>
                <th className="py-2 pe-3">{t('rules.table.effect')}</th>
                <th className="py-2 pe-3">{t('rules.table.claims')}</th>
                <th className="py-2">{t('rules.table.blockedBy')}</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pe-3 font-medium text-white">{action(ActionType.Income)}</td>
                <td className="py-2 pe-3">{t.number(0)}</td>
                <td className="py-2 pe-3">{gain(INCOME_COINS)}</td>
                <td className="py-2 pe-3 text-coup-ink-mute">{DASH}</td>
                <td className="py-2 text-coup-ink-mute">{DASH}</td>
              </tr>
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pe-3 font-medium text-white">{action(ActionType.ForeignAid)}</td>
                <td className="py-2 pe-3">{t.number(0)}</td>
                <td className="py-2 pe-3">{gain(FOREIGN_AID_COINS)}</td>
                <td className="py-2 pe-3 text-coup-ink-mute">{DASH}</td>
                <td className="py-2 text-purple-300">{character(Character.Duke)}</td>
              </tr>
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pe-3 font-medium text-white">{action(ActionType.Coup)}</td>
                <td className="py-2 pe-3">{t.number(COUP_COST)}</td>
                <td className="py-2 pe-3">{t('rules.effect.loseInfluence', p)}</td>
                <td className="py-2 pe-3 text-coup-ink-mute">{DASH}</td>
                <td className="py-2 text-coup-ink-mute">{DASH}</td>
              </tr>
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pe-3 font-medium text-purple-300">{action(ActionType.Tax)}</td>
                <td className="py-2 pe-3">{t.number(0)}</td>
                <td className="py-2 pe-3">{gain(TAX_COINS)}</td>
                <td className="py-2 pe-3 text-purple-300">{character(Character.Duke)}</td>
                <td className="py-2 text-coup-ink-mute">{DASH}</td>
              </tr>
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pe-3 font-medium text-gray-300">{action(ActionType.Assassinate)}</td>
                <td className="py-2 pe-3">{t.number(ASSASSINATE_COST)}</td>
                <td className="py-2 pe-3">{t('rules.effect.loseInfluence', p)}</td>
                <td className="py-2 pe-3 text-gray-300">{character(Character.Assassin)}</td>
                <td className="py-2 text-red-300">{character(Character.Contessa)}</td>
              </tr>
              <tr className="border-b border-coup-line/40">
                <td className="py-2 pe-3 font-medium text-blue-300">{action(ActionType.Steal)}</td>
                <td className="py-2 pe-3">{t.number(0)}</td>
                <td className="py-2 pe-3">{t('rules.effect.steal', p)}</td>
                <td className="py-2 pe-3 text-blue-300">{character(Character.Captain)}</td>
                <td className="py-2">
                  {t.rich('rules.table.pair', {
                    first: <span className="text-blue-300">{character(Character.Captain)}</span>,
                    second: <span className="text-green-300">{character(Character.Ambassador)}</span>,
                  })}
                </td>
              </tr>
              <tr>
                <td className="py-2 pe-3 font-medium text-green-300">{action(ActionType.Exchange)}</td>
                <td className="py-2 pe-3">{t.number(0)}</td>
                <td className="py-2 pe-3">{t('rules.effect.exchange', p)}</td>
                <td className="py-2 pe-3 text-green-300">{character(Character.Ambassador)}</td>
                <td className="py-2 text-coup-ink-mute">{DASH}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Challenging */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.challengeHeading')}</h3>
        <p className="text-gray-400">{t('rules.challenge', p)}</p>
      </div>

      {/* Blocking */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.blockHeading')}</h3>
        <p className="text-gray-400">{t('rules.block', p)}</p>
      </div>

      {/* Forced Coup */}
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.forcedHeading', p)}</h3>
        <p className="text-gray-400">{t('rules.forced', p)}</p>
      </div>
    </div>
  );
}

function ReformationTab({
  onOpenWalkthrough,
  walkthroughTriggerRef,
}: {
  onOpenWalkthrough: () => void;
  walkthroughTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useT();
  const p = learnParams(t);
  const tags = { ...p, term, name: term, inq };
  return (
    <div className="space-y-5 text-sm">
      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.reformation.whatIsHeading', p)}</h3>
        <p className="text-gray-400">{t.rich('rules.reformation.whatIs', tags)}</p>
      </div>

      <div className="panel-sunk bg-coup-accent/15 p-3">
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.reformation.quickStartHeading')}</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
          <li>
            {t.rich('rules.reformation.quick1', {
              loyalistMark: t('rules.markLoyalist'),
              reformistMark: t('rules.markReformist'),
              loy: (chunks: ReactNode) => <span className="text-blue-300 font-bold">{chunks}</span>,
              ref: (chunks: ReactNode) => <span className="text-red-300 font-bold">{chunks}</span>,
            })}
          </li>
          <li>{t('rules.reformation.quick2', p)}</li>
          <li>{t('rules.reformation.quick3', p)}</li>
          <li>{t('rules.reformation.quick4', p)}</li>
        </ol>
        <button
          ref={walkthroughTriggerRef}
          type="button"
          className="mt-3 w-full rounded-lg border border-coup-accent/50 bg-coup-bg/50 px-3 py-2 text-sm font-bold text-coup-accent transition hover:bg-coup-accent/10"
          onClick={() => { haptic(80); onOpenWalkthrough(); }}
        >
          {t('rules.reformation.openWalkthrough')}
        </button>
      </div>

      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.reformation.factionsHeading')}</h3>
        <p className="text-gray-400 mb-2">
          {t.rich('rules.reformation.factions', {
            ...p,
            loy: (chunks: ReactNode) => <span className="text-blue-300 font-medium">{chunks}</span>,
            ref: (chunks: ReactNode) => <span className="text-red-300 font-medium">{chunks}</span>,
          })}
        </p>
      </div>

      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{t('rules.reformation.newActionsHeading')}</h3>
        <div className="space-y-3 text-gray-400">
          <div>{t.rich('rules.reformation.convert', tags)}</div>
          <div>{t.rich('rules.reformation.embezzle', tags)}</div>
          <div>{t.rich('rules.reformation.examine', tags)}</div>
        </div>
      </div>

      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{characterName(t, Character.Inquisitor)}</h3>
        <p className="text-gray-400">{t('rules.reformation.inquisitor', p)}</p>
      </div>

      <div>
        <h3 className="text-coup-accent font-bold text-base mb-2">{p.reserve}</h3>
        <p className="text-gray-400">{t('rules.reformation.reserve', p)}</p>
      </div>
    </div>
  );
}
