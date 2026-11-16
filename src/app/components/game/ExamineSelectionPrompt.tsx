'use client';

import { Character, ClientGameState, TurnPhase } from '@/shared/types';
import { characterName, useT } from '../../i18n';
import { playerName } from './tableText';
import { getSocket } from '../../hooks/useSocket';
import { haptic } from '../../utils/haptic';
import { usePendingAnswer } from '../../hooks/usePendingAnswer';
import { Timer } from '../ui/Timer';
import { CardFace } from './CardFace';

interface ExamineSelectionPromptProps {
  gameState: ClientGameState;
}

export function ExamineSelectionPrompt({ gameState }: ExamineSelectionPromptProps) {
  const t = useT();
  const socket = getSocket();
  const { answer } = usePendingAnswer(gameState);
  const selection = gameState.examineSelectionState;

  if (
    gameState.turnPhase !== TurnPhase.AwaitingExamineSelection ||
    !selection ||
    selection.targetId !== gameState.myId
  ) {
    return null;
  }

  const me = gameState.players.find(player => player.id === gameState.myId);
  const examiner = gameState.players.find(player => player.id === selection.examinerId);
  if (!me) return null;

  return (
    <div className="prompt-action">
      <Timer expiresAt={gameState.timerExpiry} />
      <p className="mb-1 text-center text-lg font-bold text-white">
        {examiner
          ? t.rich('prompts.showTo', { name: playerName(examiner.name) })
          : t('prompts.showToInquisitor', { character: characterName(t, Character.Inquisitor) })}
      </p>
      <p className="mb-3 text-center text-xs text-gray-400">
        {t('prompts.showHint')}
      </p>
      <div className="flex justify-center gap-3">
        {me.influences.map((influence, influenceIndex) => {
          if (influence.revealed) return null;
          return (
            <CardFace
              key={influenceIndex}
              influence={influence}
              size="md"
              disablePreview
              priority
              onClick={() => answer(`show:${influenceIndex}`, () => {
                haptic(80);
                socket.emit('game:choose_examine_influence', { influenceIndex });
              })}
            />
          );
        })}
      </div>
    </div>
  );
}
