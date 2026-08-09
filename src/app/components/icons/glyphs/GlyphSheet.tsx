'use client';

import type { GlyphProps } from './GlyphBase';
import * as G from './index';

/**
 * Development proof sheet for the glyph set. Renders every glyph at 16/24/48px
 * on a dark and a light swatch so the 16px row can be judged by eye.
 *
 * This is a development aid. It is deliberately not routed — drop it into a
 * scratch page temporarily if you need to look at it in the app.
 */

type GlyphComponent = (props: GlyphProps) => React.JSX.Element;

/* The six character silhouettes lead the sheet, and `CrownGlyph` is pulled up
 * to sit immediately after `DukeGlyph` rather than staying down in "State and
 * outcome". That adjacency is not tidiness: the §1.2 crown RULING requires the
 * Duke to be diffed against the winner's crown at 16px SIDE BY SIDE before it
 * ships, and a diff you have to scroll between is a diff nobody does. */
const GLYPHS: [string, GlyphComponent][] = [
  ['DukeGlyph', G.DukeGlyph],
  ['CrownGlyph *', G.CrownGlyph],
  ['AssassinGlyph', G.AssassinGlyph],
  ['CaptainGlyph', G.CaptainGlyph],
  ['AmbassadorGlyph', G.AmbassadorGlyph],
  ['ContessaGlyph', G.ContessaGlyph],
  ['InquisitorGlyph', G.InquisitorGlyph],
  ['ChallengeGlyph', G.ChallengeGlyph],
  ['TruthGlyph', G.TruthGlyph],
  ['BluffGlyph', G.BluffGlyph],
  ['PassGlyph', G.PassGlyph],
  ['BlockGlyph', G.BlockGlyph],
  ['CoupGlyph', G.CoupGlyph],
  ['AssassinateGlyph', G.AssassinateGlyph],
  ['StealGlyph', G.StealGlyph],
  ['ExchangeGlyph', G.ExchangeGlyph],
  ['ExamineGlyph', G.ExamineGlyph],
  ['ConvertGlyph', G.ConvertGlyph],
  ['EmbezzleGlyph', G.EmbezzleGlyph],
  ['CoinGlyph', G.CoinGlyph],
  ['ClaimGlyph', G.ClaimGlyph],
  ['DeclareGlyph', G.DeclareGlyph],
  ['ResolveGlyph', G.ResolveGlyph],
  ['SkullGlyph', G.SkullGlyph],
  ['CrownGlyph', G.CrownGlyph],
  ['DeckGlyph', G.DeckGlyph],
  ['TurnGlyph', G.TurnGlyph],
  ['GameStartGlyph', G.GameStartGlyph],
  ['BotGlyph', G.BotGlyph],
  ['SpeakerGlyph', G.SpeakerGlyph],
  ['SpeakerMutedGlyph', G.SpeakerMutedGlyph],
  ['TargetGlyph', G.TargetGlyph],
  ['DiceGlyph', G.DiceGlyph],
  ['ExitGlyph', G.ExitGlyph],
];

const SIZES = [16, 24, 48];

function Swatch({ background, color, label }: { background: string; color: string; label: string }) {
  return (
    <section style={{ background, color, padding: 24 }}>
      <h2 style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16, opacity: 0.7 }}>
        {label}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 16 }}>
        {GLYPHS.map(([name, Component]) => (
          <div key={name} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, height: 56 }}>
              {SIZES.map((size) => (
                <Component key={size} size={size} />
              ))}
            </div>
            <div style={{ fontSize: 10, marginTop: 6, fontFamily: 'ui-monospace, monospace', opacity: 0.75 }}>
              {name.replace('Glyph', '')}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GlyphSheet() {
  return (
    <div>
      <Swatch background="#0A0E0F" color="#D6A12A" label="Dark / brass" />
      <Swatch background="#0A0E0F" color="#E8E2D4" label="Dark / bone" />
      <Swatch background="#E8E2D4" color="#0A0E0F" label="Light / ink" />
    </div>
  );
}
