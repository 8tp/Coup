'use client';

import { AWARD_GLYPHS } from '../../utils/logGlyphs';
import type { AwardGlyphKey } from '../../utils/logGlyphs';

interface AwardDefinition {
  glyph: AwardGlyphKey;
  title: string;
  description: string;
}

// Keep in step with the award list built by selectAwards() in gameStats.ts.
const AWARD_DEFINITIONS: AwardDefinition[] = [
  { glyph: 'bluff', title: 'Pants on Fire', description: 'Most times caught bluffing' },
  { glyph: 'truth', title: 'Honest Abe', description: 'Most times proven honest, never caught' },
  { glyph: 'challenge', title: 'The Inquisitor', description: 'Most challenges made' },
  { glyph: 'target', title: 'Eagle Eye', description: 'Best challenge accuracy' },
  { glyph: 'block', title: 'The Wall', description: 'Most blocks made' },
  { glyph: 'claim', title: 'Smooth Operator', description: 'Many claims, never caught' },
  { glyph: 'coup', title: 'Coup Machine', description: 'Most coups launched' },
  { glyph: 'assassinate', title: 'Silent Assassin', description: 'Most assassinations' },
  { glyph: 'dice', title: 'Bold Strategy', description: 'Most challenges backfired' },
  { glyph: 'exit', title: 'Quick Exit', description: 'First player eliminated' },
];

interface AwardsTabProps {
  awardCounts: Record<string, number>;
}

export function AwardsTab({ awardCounts }: AwardsTabProps) {
  const totalEarned = Object.values(awardCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {totalEarned === 0 && (
        <p className="text-center text-coup-ink-mute text-sm mb-3">
          Play games to earn awards!
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {AWARD_DEFINITIONS.map(award => {
          const count = awardCounts[award.title] ?? 0;
          const earned = count > 0;
          const AwardGlyph = AWARD_GLYPHS[award.glyph];
          return (
            <div
              key={award.title}
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
                    <p className="text-sm font-bold text-gray-200 truncate">{award.title}</p>
                    {earned && (
                      <span className="text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded-full font-bold flex-none">
                        x{count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-coup-ink-mute mt-0.5">{award.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
