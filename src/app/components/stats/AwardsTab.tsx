'use client';

interface AwardDefinition {
  emoji: string;
  title: string;
  description: string;
}

const AWARD_DEFINITIONS: AwardDefinition[] = [
  { emoji: '🤥', title: 'Pants on Fire', description: 'Most times caught bluffing' },
  { emoji: '😇', title: 'Honest Abe', description: 'Most times proven honest, never caught' },
  { emoji: '🔍', title: 'The Inquisitor', description: 'Most challenges made' },
  { emoji: '🦅', title: 'Eagle Eye', description: 'Best challenge accuracy' },
  { emoji: '🧱', title: 'The Wall', description: 'Most blocks made' },
  { emoji: '🎭', title: 'Smooth Operator', description: 'Many claims, never caught' },
  { emoji: '⚔️', title: 'Coup Machine', description: 'Most coups launched' },
  { emoji: '🗡️', title: 'Silent Assassin', description: 'Most assassinations' },
  { emoji: '🎲', title: 'Bold Strategy', description: 'Most challenges backfired' },
  { emoji: '🚪', title: 'Quick Exit', description: 'First player eliminated' },
];

interface AwardsTabProps {
  awardCounts: Record<string, number>;
}

export function AwardsTab({ awardCounts }: AwardsTabProps) {
  const totalEarned = Object.values(awardCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {totalEarned === 0 && (
        <p className="text-center text-gray-500 text-sm mb-3">
          Play games to earn awards!
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {AWARD_DEFINITIONS.map(award => {
          const count = awardCounts[award.title] ?? 0;
          const earned = count > 0;
          return (
            <div
              key={award.title}
              className={`bg-coup-bg/60 rounded-xl border p-3 transition-opacity ${
                earned
                  ? 'border-yellow-600/60'
                  : 'border-gray-800 opacity-40'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none">{award.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-gray-200 truncate">{award.title}</p>
                    {earned && (
                      <span className="text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded-full font-bold flex-none">
                        x{count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{award.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
