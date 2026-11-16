'use client';

import type { Award } from '../../../utils/gameStats';
import { AWARD_GLYPHS, type GlyphComponent } from '../../../utils/logGlyphs';
import { BluffGlyph, ChallengeGlyph, CoupGlyph, TruthGlyph } from '../../icons';

interface RecapLine {
  key: string;
  glyph: GlyphComponent;
  text: string;
}

interface GameRecapProps {
  finish: string | null;
  bluffs: string | null;
  /** Every claim was honest: the line takes the truth glyph, not the bluff one. */
  allHonest: boolean;
  challenges: string | null;
  awards: Award[];
  headingId: string;
  awardsHeadingId: string;
}

/**
 * "How it went" and the awards: short, specific lines on the table's own
 * plates. Every line is a sentence with its numbers in it, so there is no
 * label-over-value tile to repeat itself.
 */
export function GameRecap({ finish, bluffs, allHonest, challenges, awards, headingId, awardsHeadingId }: GameRecapProps) {
  const lines: RecapLine[] = [];
  if (finish) lines.push({ key: 'finish', glyph: CoupGlyph, text: finish });
  if (bluffs) lines.push({ key: 'bluffs', glyph: allHonest ? TruthGlyph : BluffGlyph, text: bluffs });
  if (challenges) lines.push({ key: 'challenges', glyph: ChallengeGlyph, text: challenges });

  return (
    <>
      {lines.length > 0 && (
        <section aria-labelledby={headingId} className="gameover-section animate-fade-in">
          <h2 id={headingId} className="gameover-heading">How it went</h2>
          <ul className="gameover-plate gameover-lines">
            {lines.map(({ key, glyph: Glyph, text }) => (
              <li key={key} className="gameover-line">
                <Glyph size={16} className="gameover-line-glyph" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {awards.length > 0 && (
        <section aria-labelledby={awardsHeadingId} className="gameover-section animate-fade-in">
          <h2 id={awardsHeadingId} className="gameover-heading">Awards</h2>
          <ul className="gameover-awards">
            {awards.map(award => {
              const Glyph = AWARD_GLYPHS[award.glyph];
              return (
                <li key={award.title} className="gameover-plate gameover-award">
                  <Glyph size={18} className="gameover-line-glyph" />
                  <span className="min-w-0">
                    <span className="gameover-award-title">{award.title}</span>
                    <span className="gameover-award-who">
                      <span className="text-coup-ink">{award.playerName}</span>, {award.description}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
