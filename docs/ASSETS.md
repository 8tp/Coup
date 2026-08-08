# Visual Asset Notes

This app should use generated raster assets where they add mood, identity, or card-table texture, and keep SVG/code-native assets where precision matters.

## Good Imagegen Targets

- **Home title banner** -- The first screen benefits from a branded raster masthead instead of plain SVG text. Current asset: `public/assets/brand/coup-online-banner-v2.webp`.
- **Influence card faces** -- Character portraits make known and revealed cards feel like real influence cards. Current UI assets: `public/assets/cards/{duke,assassin,captain,ambassador,contessa,inquisitor}-v3.webp`.
- **Small-card close crops** -- Tiny mobile cards should use face/prop-forward crops instead of the full portrait composition. Current UI assets: `public/assets/cards/focus/{duke,assassin,captain,ambassador,contessa,inquisitor}-v3.webp`.
- **Influence card back** -- Hidden cards need one recognizable card-back treatment. Current assets: `public/assets/cards/back-v2.webp` and `public/assets/cards/focus/back-v2.webp`.
- **Game table backgrounds** -- The shared app background can use subtle raster tabletops because they add atmosphere without carrying gameplay state. Current assets: `public/assets/backgrounds/game-table-v2.webp` and `public/assets/backgrounds/game-table-mobile-v2.webp`.
- **App/project icon** -- Home-screen/PWA icons need a strong raster emblem that reads at 16-512 px. The 1024 px master is `public/assets/brand/app-icon-v2.png`; versioned PWA, Apple touch, maskable, and favicon derivatives live under `public/icons/` and `public/`.
- **Social/share imagery** -- Open Graph, README screenshots, and store/promotional surfaces can use composed raster art because they are not interactive controls. Current assets: `public/og-image-v3.png` and `public/embed-image-v3.png`.

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

The v2 brand, environment, icon, and card-back system was generated in Midjourney V8.1 using the approved character portraits as style references. The palette is blackened teal, crimson enamel, aged brass, and restrained cyan, with screen-printed gouache texture and a fictional 1970s dystopian civic-design language.

| Source download | Repository output | Production treatment |
| --- | --- | --- |
| `Desktop Wallpaper.png` | `game-table-v2.webp` | 1456×816 WebP, quality 82 |
| `Mobile Table.png` | `game-table-mobile-v2.webp` | 816×1456 WebP, quality 82 |
| `Wordmark.png` | `coup-online-banner-v2.webp` | black keyed to alpha; 864×344 WebP at quality 92 |
| `Card Back.png` | `back-v2.webp` and `focus/back-v2.webp` | full 512×768 plus centered focus crop |
| `App Icon.png` | `app-icon-v2.png` plus PWA/favicon derivatives | master retained at 1024 px; Lanczos downscales |
| `promotional.png` | `og-image-v3.png` and `embed-image-v3.png` | exact project text and the six approved cards composited afterward |

### App Icon

```text
A single original retro-futurist political intrigue emblem for a bluffing strategy game,
an abstract fractured civic crown reduced to severe geometric planes intersecting a
narrow vertical signal beam, backed by a partially eclipsed disc, perfectly centered,
immediately recognizable at 32 pixels, dark crimson enamel, oxidized brass, blackened
teal and one restrained cyan highlight, screen-printed gouache and ink texture, generous
safe margin, no words, no people, no medieval heraldry --ar 1:1 --v 8.1 --raw --s 90 --c 8
```

The maskable derivative scales the master emblem to 86% and feathers it over an opaque teal extension so the important geometry stays within platform safe zones. Normal, Apple touch, and favicon derivatives retain the full composition.

### Title Banner

```text
Wide horizontal retro-futurist political-thriller board-game wordmark displaying the
exact words "COUP ONLINE" and no other writing, bold condensed geometric capitals with
sharp asymmetric cuts, dark crimson enamel faces, oxidized-brass edges, restrained cyan
offset shadow, screen-printed ink wear, a small split-eclipse civic emblem, perfectly
front-facing on near-black, no mockup, no extra writing --ar 5:2 --v 8.1 --raw --s 60 --c 5
```

### Card Back

```text
Perfectly symmetrical vertical influence-card back for a retro-futurist dystopian
bluffing game, central fractured-crown and eclipse civic emblem, nested blackened-teal
and charcoal panels, oxidized-brass circuit-like border, crimson enamel center,
screen-printed gouache and ink, aged paper grain, strong silhouette readable at 48 pixels,
no people, no writing, no mockup --ar 2:3 --v 8.1 --raw --s 110 --c 6
```

### Desktop Game Table Background

```text
Strict 90-degree overhead orthographic flat-lay view of a rectangular retro-futurist
strategy-game tabletop, camera pointing perfectly downward, entire frame filled by a
blackened-teal playing surface with an oxblood perimeter, aged-brass routing lines and
small props only at the corners, central seventy-five percent empty and low-contrast,
no room, no horizon, no vanishing point, no angled camera --ar 16:9 --v 8.1 --raw --s 100 --c 4
```

### Mobile Game Table Background

```text
Portrait mobile background showing a complete retro-futurist strategy table, strict overhead
view, blackened-teal composite surface with oxblood and aged-brass borders visible on every
side, tiny props at the outer corners, central seventy percent calm and low-detail, scaled
to a phone rather than cropped from desktop, no people or writing --ar 9:16 --v 8.1 --raw --s 125 --c 8
```

### Social Preview

`promotional.png` supplies the 40:21 council-chamber backdrop only. The final 1200×630 image is composed locally with a translucent upper shade, the keyed v2 wordmark, exact HTML-equivalent marketing copy, and the six real v3 card portraits. This covers the generated placeholder card shapes and prevents text or character drift.

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
