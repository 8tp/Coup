# Visual Asset Notes

This app should use generated raster assets where they add mood, identity, or card-table texture, and keep SVG/code-native assets where precision matters.

## Good Imagegen Targets

- **Home title banner** -- The first screen benefits from a branded raster masthead instead of plain SVG text. Current asset: `public/assets/brand/coup-online-banner.png`.
- **Influence card faces** -- Character portraits make known and revealed cards feel like real influence cards. Current UI assets: `public/assets/cards/{duke,assassin,captain,ambassador,contessa,inquisitor}-v3.webp`.
- **Small-card close crops** -- Tiny mobile cards should use face/prop-forward crops instead of the full portrait composition. Current UI assets: `public/assets/cards/focus/{duke,assassin,captain,ambassador,contessa,inquisitor}-v3.webp`.
- **Influence card back** -- Hidden cards need one recognizable card-back treatment. Current assets: `public/assets/cards/back.webp` and `public/assets/cards/focus/back.webp`.
- **Game table backgrounds** -- The shared app background can use subtle raster tabletops because they add atmosphere without carrying gameplay state. Current assets: `public/assets/backgrounds/game-table.webp` and `public/assets/backgrounds/game-table-mobile.webp`.
- **App/project icon** -- Home-screen/PWA icons need a strong raster emblem that reads at 16-512 px. Current assets: `public/coup-logo.png`, `public/coup-logo-transparent.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/apple-touch-icon.png`, `public/favicon-16x16.png`, `public/favicon-32x32.png`, and `public/favicon.ico`.
- **Social/share imagery** -- Open Graph, README screenshots, and store/promotional surfaces can use composed raster art because they are not interactive controls. Current assets: `public/og-image-v2.png` and `public/embed-image-v2.png`.

## Keep Code-Native

- **Action button icons** -- Tax, Steal, Assassinate, Exchange, and prompt controls need deterministic, small-size readability.
- **Faction badges and timers** -- These are state indicators, so SVG/CSS keeps them crisp and accessible.
- **Status banners and prompt text** -- Text should stay in HTML for exact wording, localization, and screen-reader behavior.
- **Small card labels** -- Role/action labels such as `CAPTAIN` / `STEAL`, `DUKE` / `TAX`, `ASSASSIN` / `KILL`, `AMBASSADOR` / `EXCHANGE`, and `CONTESSA` / `BLOCK` should stay in HTML/CSS over the art, not baked into generated images.
- **QR codes and room codes** -- These should never be generated imagery.

## Loading Strategy

- Preload the home title banner and the viewport-specific table background from `src/app/layout.tsx`.
- Prefetch the focus card faces and focus card back after the initial page so gameplay reveal/exchange surfaces can reuse the browser cache.
- Card artwork uses fixed intrinsic dimensions, `decoding="async"`, lazy loading by default, and `fetchPriority="high"` only for immediately visible or interactive cards.
- Production image responses from `public/` get a one-day browser cache with stale-while-revalidate; keep filenames versioned when replacing important assets that need instant cache busting.

## Generated Asset Prompts

The foundational assets below were generated with the built-in `image_gen` tool. The v3 character-card set is the documented Midjourney exception.

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

The social card was composed from generated project assets so display text remains exact: `public/assets/backgrounds/game-table.webp`, `public/assets/brand/coup-online-banner.png`, `public/coup-logo-transparent.png`, and the selected `*-v3.webp` character-card portraits.

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

The v3 character cards are original Midjourney illustrations made for this project. They reinterpret the game's six roles as a cohesive retro-futurist dystopian court: editorial portrait framing, screen-printed paper texture, hard graphic shadows, restrained geometric architecture, and a distinct role color. No official game artwork was supplied as an image reference or bundled in the repository.

Each source was a 1792×2688 four-up grid. The approved 896×1344 quadrant was exported to a 512×768 WebP for normal cards, then reframed into a tighter crop at the same output size for small gameplay surfaces.

| Role | Selected variation | Focus crop `(x, y, w, h)` | Visual identity |
| --- | --- | --- | --- |
| Duke | `0bfa152b…`, top-left | `120, 0, 720, 1080` | Plum and antique gold; silver-haired corporate ruler at an obsidian council dais |
| Assassin | `ae7ca449…`, top-left | `32, 0, 832, 1248` | Slate and electric blue; female operative with a blunt fringe and sculptural platinum ponytail |
| Captain | `879c6c0f…`, top-left | `64, 0, 768, 1152` | Cobalt and brass; naval commander over a tactical display |
| Ambassador | `22544db9…`, bottom-right | `128, 0, 768, 1152` | Chartreuse and amber; diplomat with a translation visor in an embassy concourse |
| Contessa | `c4aeb41c…`, top-left | `64, 0, 768, 1152` | Crimson and gold; aristocratic protector with a strong heraldic silhouette |
| Inquisitor | `e450c4c8…`, top-left | `64, 0, 768, 1152` | Deep teal and pale cyan; watchful investigator with an optical device |

The prompt structure kept the renderer, era, finish, and framing consistent while varying each role's casting, silhouette, location, palette, and readable prop:

```text
Retro-futurist dystopian board-game character illustration of <role and casting>,
<distinctive face, hair, clothing and one readable role prop>, <role-specific setting>,
editorial 1960s/1970s science-fiction paperback art, screen-printed gouache and ink,
subtle aged paper grain, hard graphic shadows, elegant geometric architecture,
limited <role palette>, centered three-quarter portrait, waist-up, strong silhouette,
generous crop-safe space around the head, premium tabletop card art, no text,
no letters, no numbers, no logo, no watermark, no card border, no split panels,
no collage --ar 2:3 --v 8.2 --raw --s 150 --c 15
```

Role prompts should describe the character rather than name an existing actor or artist. Keep the shared style clause and parameters unchanged between roles; vary pose and setting deliberately so the set stays related without becoming six palette swaps. Generated grids may drift from the requested casting, so selection is based on the artwork itself rather than prompt wording alone.

### Character Card Production

1. Download the original Midjourney grid, not an HD reinterpretation, so the approved variation remains exact.
2. Crop the selected quadrant losslessly at 896×1344.
3. Create the full asset by scaling the quadrant to 512×768 and encode it as WebP at quality 84.
4. Create a separate 2:3 focus crop around the face and role prop, then scale and encode it with the same settings. Leave extra vertical safety for the UI's `object-cover` card containers.
5. Update both maps in `src/app/utils/assets.ts`, the service-worker precache list, README thumbnails, social previews, and this document.
6. Bump versioned filenames and `CACHE_NAME` in `public/sw.js` together so installed clients do not retain the previous portraits.

Do not bake names, action labels, borders, or icons into the raster art. Those remain code-native so they stay sharp, accessible, and consistent across full cards, compact cards, reveal overlays, tutorials, Exchange, Examine, and post-game views.
