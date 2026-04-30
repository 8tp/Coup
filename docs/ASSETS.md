# Visual Asset Notes

This app should use generated raster assets where they add mood, identity, or card-table texture, and keep SVG/code-native assets where precision matters.

## Good Imagegen Targets

- **Home title banner** -- The first screen benefits from a branded raster masthead instead of plain SVG text. Current asset: `public/assets/brand/coup-online-banner.png`.
- **Influence card faces** -- Character portraits make known and revealed cards feel like real influence cards. Current UI assets: `public/assets/cards/{duke,assassin,captain,ambassador,contessa,inquisitor}-v2.webp`.
- **Small-card close crops** -- Tiny mobile cards should use face/prop-forward crops instead of the full portrait composition. Current UI assets: `public/assets/cards/focus/{duke,assassin,captain,ambassador,contessa,inquisitor}-v2.webp`.
- **Influence card back** -- Hidden cards need one recognizable card-back treatment. Current assets: `public/assets/cards/back.webp` and `public/assets/cards/focus/back.webp`.
- **Game table backgrounds** -- The shared app background can use subtle raster tabletops because they add atmosphere without carrying gameplay state. Current assets: `public/assets/backgrounds/game-table.webp` and `public/assets/backgrounds/game-table-mobile.webp`.
- **App/project icon** -- Home-screen/PWA icons need a strong raster emblem that reads at 16-512 px. Current assets: `public/coup-logo.png`, `public/coup-logo-transparent.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/apple-touch-icon.png`, `public/favicon-16x16.png`, `public/favicon-32x32.png`, and `public/favicon.ico`.
- **Social/share imagery** -- Open Graph, README screenshots, and store/promotional surfaces can use composed raster art because they are not interactive controls. Current assets: `public/og-image.png` and `public/embed-image.png`.

## Keep Code-Native

- **Action button icons** -- Tax, Steal, Assassinate, Exchange, and prompt controls need deterministic, small-size readability.
- **Faction badges and timers** -- These are state indicators, so SVG/CSS keeps them crisp and accessible.
- **Status banners and prompt text** -- Text should stay in HTML for exact wording, localization, and screen-reader behavior.
- **Small card labels** -- Role/action labels such as `CAPTAIN` / `STEAL`, `DUKE` / `TAX`, `ASSASSIN` / `KILL`, `AMBASSADOR` / `EXCHANGE`, and `CONTESSA` / `BLOCK` should stay in HTML/CSS over the art, not baked into generated images.
- **QR codes and room codes** -- These should never be generated imagery.

## Generated Asset Prompts

Generated with the built-in `image_gen` tool.

### App Icon

```text
Use case: logo-brand
Asset type: square app icon for Coup Online PWA, favicon, README project icon, and mobile home-screen shortcut
Primary request: create an original premium square app icon for a dark court-intrigue bluffing card game called Coup Online
Subject: a simple antique-gold crown over a vertical dagger, with two subtle crossed influence-card silhouettes behind it, small crimson enamel accents, on a deep emerald-black velvet square
Style/medium: polished board-game app icon, crisp emblem, high contrast, readable at 32px and 192px, modern iOS/Android app icon polish
Composition/framing: centered emblem, generous safe margin, square 1:1 composition, slightly rounded-square friendly design, no border that would disappear when masked
Lighting/mood: dramatic low-key lighting with warm gold highlights, secretive and refined
Color palette: near-black emerald, antique gold, deep crimson, small cool steel highlights
Materials/textures: brushed metal, enamel, velvet, subtle paper grain
Text (verbatim): none
Constraints: no text, no letters, no numbers, no watermark, no official Coup artwork, no people or faces, simple silhouette readable at favicon size, avoid tiny details
Avoid: words, initials, QR codes, busy background, full card faces, overly complex heraldry, cartoon style
```

The social card was composed from generated project assets so display text remains exact: `public/assets/backgrounds/game-table.webp`, `public/assets/brand/coup-online-banner.png`, `public/coup-logo-transparent.png`, and selected `*-v2.webp` character-card portraits.

### Title Banner

```text
Use case: logo-brand
Asset type: home screen title banner for a dark mobile-first web card game
Primary request: create an original raster title banner with exact readable text for the game, not based on official Coup board-game art
Subject: the words COUP ONLINE with subtle crown and dagger court-intrigue motifs
Style/medium: premium board-game title treatment, polished red enamel lettering with antique gold bevels, light metallic wear, dark transparent-looking background suitable for a dark UI
Composition/framing: wide horizontal banner, centered, strong silhouette, readable when displayed around 260-320 px wide
Lighting/mood: dramatic low-key studio lighting, refined and tense
Color palette: deep crimson, antique gold, small cool silver-blue accents, near-black negative space
Text (verbatim): "COUP ONLINE"
Constraints: spell the text exactly as COUP ONLINE; no other words; no watermark; no official Coup artwork; avoid busy background; keep edges clean for web use
Avoid: extra letters, misspellings, small unreadable subtitle text, logos, QR codes, people, cards covering the words
```

### Card Back

```text
Use case: stylized-concept
Asset type: reusable card back art for Coup Online influence cards
Primary request: create an original vertical playing-card back, no text, for a dark court-intrigue bluffing game
Subject: symmetrical crown, dagger, and diamond heraldry pattern, designed as a premium card back
Style/medium: polished digital board-game card art, ornate but readable at small sizes
Composition/framing: vertical 2:3 card portrait, centered emblem, full-bleed art, no outer transparent margin
Lighting/mood: dark, secretive, metallic highlights
Color palette: near-black navy, antique gold, restrained crimson accents
Materials/textures: worn enamel, brushed metal, subtle paper grain
Constraints: no letters, no numbers, no watermark, no official Coup artwork, no white border; keep central motif simple enough to read at 48px tall
Avoid: text, QR codes, faces, extra icons, busy repeating detail
```

### Game Table Background

```text
Use case: stylized-concept
Asset type: subtle full-screen game background for a web card game UI
Primary request: a dark, low-contrast political intrigue tabletop background for Coup Online
Scene/backdrop: top-down/three-quarter view of a luxurious strategy game table in a dim court chamber, with dark green-black velvet, muted burgundy leather edges, faint antique gold filigree, soft shadows from candles outside the frame, and barely visible scattered coins and face-down cards near the edges
Subject: atmospheric tabletop surface only; no people, no readable cards, no logos, no text
Style/medium: polished painterly-realistic game UI background, refined and expensive, not busy
Composition/framing: wide 16:9 composition, central area intentionally calm and dark for UI readability, details concentrated toward corners and edges, seamless enough to crop on mobile
Lighting/mood: moody, conspiratorial, warm gold rim light, restrained contrast
Color palette: deep charcoal, blackened navy, dark emerald, muted burgundy, antique gold highlights
Materials/textures: velvet felt, aged leather, tarnished metal coin hints, subtle paper/card texture
Constraints: no text, no watermark, no characters, no large bright areas, no high-detail focal object in the center, do not make it look like a marketing hero image
Avoid: neon colors, purple-blue gradient background, ornate clutter in the center, readable symbols, oversized objects, cartoon style
```

### Mobile Game Table Background

```text
Use case: stylized-concept
Asset type: portrait mobile game background for a web card game UI
Primary request: create a mobile-specific version of the Coup Online game table background with the same dark political-intrigue aesthetic as the visible reference image, but composed for a phone screen so the tabletop feels scaled down and fits the full portrait viewport.
Input images: visible reference image is the current desktop table background; match its mood, palette, material style, and restraint, but do not simply crop it.
Scene/backdrop: top-down/three-quarter view of a luxurious strategy game table in a dim court chamber, dark green-black velvet center, muted burgundy leather border, faint antique gold filigree, very soft candle glow outside the frame, small coins and face-down cards near corners and edges.
Subject: atmospheric tabletop surface only; no people, no readable cards, no logos, no text.
Style/medium: polished painterly-realistic game UI background, refined and expensive, low-contrast, not busy.
Composition/framing: vertical 9:16 mobile composition. Keep the full table border visible enough at top, bottom, and sides so it reads as a smaller tabletop fitted to mobile. Central 70% must remain calm, dark, and low-detail for UI readability. Place edge details smaller and farther toward corners than the desktop version; do not crowd the middle.
Lighting/mood: moody, conspiratorial, warm antique-gold rim light, restrained contrast.
Color palette: deep charcoal, blackened navy, dark emerald, muted burgundy, antique gold highlights.
Materials/textures: velvet felt, aged leather, tarnished metal coin hints, subtle paper/card texture.
Constraints: portrait/mobile-first; no text, no watermark, no characters, no large bright areas, no high-detail focal object in the center; must remain readable behind dense mobile UI.
Avoid: a zoomed-in crop, neon colors, purple-blue gradient background, ornate clutter in the center, readable symbols, oversized objects, cartoon style.
```

### Character Cards

The v2 character cards intentionally mirror the SVG/action palette so card identity is readable before the text label:

- Duke: royal purple and antique gold for `TAX`
- Assassin: slate gray and cold silver for `KILL`
- Captain: royal blue and brass for `STEAL`
- Ambassador: emerald green and gold for `EXCHANGE`
- Contessa: crimson red and gold for `BLOCK`
- Inquisitor: deep teal and pale teal for `EXAMINE`

Base v2 prompt shape used for each character:

```text
Use case: stylized-concept
Asset type: vertical 2:3 influence card face portrait for Coup Online, <character> v2
Primary request: create an original <character> portrait that is immediately distinct from the other roles and strongly communicates the <role color> / <action> action color system
Subject: <character-specific court-intrigue bust portrait with one readable action prop>
Style/medium: polished semi-realistic digital board-game card illustration, premium dark court-intrigue style, cohesive with a multiplayer bluffing card game
Composition/framing: vertical 2:3 portrait, head and shoulders large, role prop clearly readable at tiny mobile card size, central bust silhouette, crop-safe, full-bleed art with no border
Lighting/mood: dramatic lighting matching the character and action
Color palette: dominant character/action color from the SVG icon, secondary highlight color, antique gold only as accent
Materials/textures: period clothing, metal, parchment or role-specific props, subtle painterly paper grain
Text (verbatim): none
Constraints: original art only; no text, no letters, no numbers, no watermark, no border, no official Coup artwork; role must read through color and props even when displayed very small
Avoid: generic brown palette, modern clothing, extra characters, busy background, text labels, card frame, logo
```
