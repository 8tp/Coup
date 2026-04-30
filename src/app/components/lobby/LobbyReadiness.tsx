'use client';

import { ClientRoomPlayer, ClientSpectator, GameMode, RoomSettings } from '@/shared/types';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/shared/constants';

export type PresetId = 'table-classic' | 'fast-lunch' | 'reformation-table';

interface LobbyReadinessProps {
  players: ClientRoomPlayer[];
  spectators: ClientSpectator[];
  settings: RoomSettings;
  isHost: boolean;
  canStart: boolean;
  onApplyPreset: (presetId: PresetId) => void;
}

const PRESETS: Array<{ id: PresetId; label: string; summary: string }> = [
  {
    id: 'table-classic',
    label: 'Table Classic',
    summary: 'Private room, classic rules, relaxed phone pace.',
  },
  {
    id: 'fast-lunch',
    label: 'Fast Lunch',
    summary: 'Shorter timers for quick games between bites.',
  },
  {
    id: 'reformation-table',
    label: 'Reformation',
    summary: 'Factions and Inquisitor enabled for a fuller game.',
  },
];

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

export function presetSettings(presetId: PresetId, current: RoomSettings): RoomSettings {
  switch (presetId) {
    case 'table-classic':
      return {
        ...current,
        isPublic: false,
        gameMode: GameMode.Classic,
        useInquisitor: false,
        actionTimerSeconds: 20,
        turnTimerSeconds: 45,
        botMinReactionSeconds: Math.min(current.botMinReactionSeconds, 3),
      };
    case 'fast-lunch':
      return {
        ...current,
        isPublic: false,
        gameMode: GameMode.Classic,
        useInquisitor: false,
        actionTimerSeconds: 10,
        turnTimerSeconds: 20,
        botMinReactionSeconds: Math.min(current.botMinReactionSeconds, 1.5),
      };
    case 'reformation-table':
      return {
        ...current,
        isPublic: false,
        gameMode: GameMode.Reformation,
        useInquisitor: true,
        actionTimerSeconds: 20,
        turnTimerSeconds: 45,
        botMinReactionSeconds: Math.min(current.botMinReactionSeconds, 3),
      };
  }
}

export function LobbyReadiness({
  players,
  spectators,
  settings,
  isHost,
  canStart,
  onApplyPreset,
}: LobbyReadinessProps) {
  const humanCount = players.filter(p => !p.isBot).length;
  const botCount = players.length - humanCount;
  const connectedHumans = players.filter(p => !p.isBot && p.connected).length;
  const needPlayers = Math.max(0, MIN_PLAYERS - players.length);
  const startStatus = canStart
    ? 'Ready to start'
    : `Need ${plural(needPlayers, 'more player')}`;

  return (
    <div className={`card-container mb-6 ${canStart ? 'border-coup-accent/50' : ''}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-bold text-gray-300 text-sm uppercase">Table Readiness</h2>
          <p className={`text-xs mt-0.5 ${canStart ? 'text-green-400' : 'text-yellow-300'}`}>
            {startStatus}
          </p>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
          canStart ? 'bg-green-500/15 text-green-300 border border-green-500/30' : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
        }`}>
          {players.length}/{MAX_PLAYERS}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-coup-bg/70 border border-gray-800 p-2">
          <span className="block text-gray-500 uppercase text-[10px]">People</span>
          <span className="font-bold text-gray-200">{connectedHumans}/{humanCount} connected</span>
        </div>
        <div className="rounded-lg bg-coup-bg/70 border border-gray-800 p-2">
          <span className="block text-gray-500 uppercase text-[10px]">Mode</span>
          <span className="font-bold text-gray-200">
            {settings.gameMode}{settings.useInquisitor ? ' + Inquisitor' : ''}
          </span>
        </div>
        <div className="rounded-lg bg-coup-bg/70 border border-gray-800 p-2">
          <span className="block text-gray-500 uppercase text-[10px]">Pace</span>
          <span className="font-bold text-gray-200">{settings.actionTimerSeconds}s / {settings.turnTimerSeconds}s</span>
        </div>
        <div className="rounded-lg bg-coup-bg/70 border border-gray-800 p-2">
          <span className="block text-gray-500 uppercase text-[10px]">Extras</span>
          <span className="font-bold text-gray-200">{plural(botCount, 'bot')} / {plural(spectators.length, 'watcher')}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Keep each phone private. Use the room code or QR link to bring friends in at the table.
      </p>

      {isHost && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold mb-2">Presets</div>
          <div className="grid gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset.id)}
                className="text-left rounded-lg border border-gray-700 bg-coup-bg/70 px-3 py-2 transition hover:border-coup-accent active:scale-[0.99]"
              >
                <span className="block text-sm font-bold text-gray-200">{preset.label}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{preset.summary}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
