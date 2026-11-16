'use client';

import type { ReactNode } from 'react';
import type { Award } from '../../../utils/gameStats';
import { AWARD_GLYPHS, type GlyphComponent } from '../../../utils/logGlyphs';
import { useT } from '../../../i18n/react';
import { BluffGlyph, ChallengeGlyph, CoupGlyph, TruthGlyph } from '../../icons';
import { awardLine, type Reader, type RecapMessage } from './summary';
import { useRecapText } from './RecapText';

interface RecapLine {
  key: string;
  glyph: GlyphComponent;
  text: ReactNode;
}

interface GameRecapProps {
  finish: RecapMessage | null;
  bluffs: RecapMessage | null;
  /** Every claim was honest: the line takes the truth glyph, not the bluff one. */
  allHonest: boolean;
  challenges: RecapMessage | null;
  awards: Award[];
  reader: Reader;
  headingId: string;
  awardsHeadingId: string;
}

/**
 * "How it went" and the awards: short, specific lines on the table's own
 * plates. Every line is a sentence with its numbers in it, so there is no
 * label-over-value tile to repeat itself.
 */
export function GameRecap({ finish, bluffs, allHonest, challenges, awards, reader, headingId, awardsHeadingId }: GameRecapProps) {
  const t = useT();
  const text = useRecapText(reader);
  const lines: RecapLine[] = [];
  if (finish) lines.push({ key: 'finish', glyph: CoupGlyph, text: text(finish) });
  if (bluffs) lines.push({ key: 'bluffs', glyph: allHonest ? TruthGlyph : BluffGlyph, text: text(bluffs) });
  if (challenges) lines.push({ key: 'challenges', glyph: ChallengeGlyph, text: text(challenges) });

  return (
    <>
      {lines.length > 0 && (
        <section aria-labelledby={headingId} className="gameover-section animate-fade-in">
          <h2 id={headingId} className="gameover-heading">{t('gameover.recapHeading')}</h2>
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
          <h2 id={awardsHeadingId} className="gameover-heading">{t('gameover.awardsHeading')}</h2>
          <ul className="gameover-awards">
            {awards.map(award => {
              const Glyph = AWARD_GLYPHS[award.glyph];
              return (
                <li key={award.id} className="gameover-plate gameover-award">
                  <Glyph size={18} className="gameover-line-glyph" />
                  <span className="min-w-0">
                    <span className="gameover-award-title">{t(`gameover.awardTitle.${award.id}`)}</span>
                    <span className="gameover-award-who">{text(awardLine(award))}</span>
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
