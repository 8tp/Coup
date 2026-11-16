'use client';

import { AWARD_GLYPHS } from '../../utils/logGlyphs';
import { AWARD_GLYPH, AWARD_IDS } from '../../utils/gameStats';
import { useT } from '../../i18n/react';

interface AwardsTabProps {
  /** Times earned, by award id (legacy English names are converted on load). */
  awardCounts: Record<string, number>;
}

export function AwardsTab({ awardCounts }: AwardsTabProps) {
  const t = useT();
  const totalEarned = Object.values(awardCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {totalEarned === 0 && (
        <p className="text-center text-coup-ink-mute text-sm mb-3">
          {t('stats.awardsEmpty')}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {AWARD_IDS.map(id => {
          const count = awardCounts[id] ?? 0;
          const earned = count > 0;
          const AwardGlyph = AWARD_GLYPHS[AWARD_GLYPH[id]];
          return (
            <div
              key={id}
              className={`panel-sunk p-3 transition-opacity ${
                earned
                  ? 'bg-coup-accent/15'
                  : 'bg-coup-bg/60 opacity-40'
              }`}
            >
              <div className="flex items-start gap-2">
                <AwardGlyph size={20} className={`flex-none mt-0.5 ${earned ? 'text-coup-accent' : 'text-gray-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-gray-200 min-w-0 break-words">{t(`gameover.awardTitle.${id}`)}</p>
                    {earned && (
                      <span className="text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded-full font-bold flex-none">
                        {t('stats.awardCount', { count })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-coup-ink-mute mt-0.5">{t(`stats.awardCriterion.${id}`)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
