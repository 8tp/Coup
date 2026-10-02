# Coup Online — asset brief (use the $imagegen skill, built-in image_gen tool)

You are generating raster assets for "Coup Online", a browser bluffing card game. Art direction
("The Ministry"): screen-printed civic propaganda from a fictional 1970s dystopian court; gouache
and ink pushed through a screen onto handled card stock; palette = blackened teal (#090D0E,
#17231F, #22302B), oxblood/crimson enamel (#5F141C, #8A1F2B), aged brass (#D6A12A, #B8892A),
bone paper (#F1EBDE), restrained cyan accent. Nothing glows; no neon, no lens flares, no 3D
chrome, no photorealism. Reference images in this folder: ref-duke.png and ref-contessa.png are
the approved character card art (match their screen-print texture and palette); ref-current-back.png
and ref-current-wordmark.png are the CURRENT assets being replaced (do not copy them).

Generate each variant with a separate built-in image_gen call. After generating, COPY every
generated image from $CODEX_HOME/generated_images/... into THIS folder with the exact filenames
below (PNG). Do not write anywhere else. When done, write RESULTS.md listing each file, its pixel
size, and one line on how it differs from its siblings.

## 1. Card back — 3 variants: back-a.png, back-b.png, back-c.png (portrait 2:3, e.g. 1024x1536)
The face-down side of an influence card. The problem with the current back: it is busy and a huge
red V-shape dominates, so at 40px tall it reads as a red blob and competes with the face cards.
Requirements:
- Perfectly symmetrical (left/right AND top/bottom, so it reads the same rotated 180°).
- Mostly a calm, dark blackened-teal field with a subtle halftone / fine guilloche screen texture.
- A thin aged-brass double-rule border inset ~6% from the edge, with small corner ornaments.
- ONE centered brass emblem occupying ~30–40% of the card width: a split eclipse disc / civic seal
  (variant a: eclipse disc in a circle; b: a heraldic seal with a fleur and laurel; c: a geometric
  starburst/rosette). Small accents of oxblood allowed, but no large red areas.
- Must clearly read as "a hidden card" when shrunk to 40x56 px: dark field + one bright centered mark.
- Full-bleed card face filling the whole canvas edge to edge (no card shown on a table, no
  mockup, no perspective, no drop shadow, no rounded-corner background showing).
- No text, no letters, no numbers, no people.

## 2. Wordmark — 3 variants: wordmark-a.png, wordmark-b.png, wordmark-c.png (wide ~5:2, TRANSPARENT background)
The title lockup for the home screen. Exact text: "COUP" as the dominant word, with "ONLINE" set
much smaller beneath it in widely spaced capitals (variant c may put ONLINE on a small brass
ribbon/plate). No other words or letters anywhere.
- COUP: bold condensed geometric civic-poster capitals with a few sharp asymmetric cuts, crimson
  enamel faces with an aged-brass edge/inline, light screen-print ink wear (keep edges crisp and
  legible — the current one is too distressed and muddy at small sizes).
- Must stay legible at 240 px wide on a near-black teal background.
- Transparent background (real alpha), no box, no backdrop, no mockup, perfectly front-facing.
- Variant a: pure type. Variant b: with a small split-eclipse emblem integrated above or into the O.
  Variant c: ONLINE on a slim brass plate under COUP.

## 3. Menu background — 2 images: menu-bg-wide.png (16:9, e.g. 1536x1024) and menu-bg-tall.png (9:16, e.g. 1024x1536)
Backdrop behind the home menu. A dim palace council chamber at night, seen from a high three-quarter
angle: a large OVAL council table in the lower-middle of the frame with an oxblood enamel rim, a thin
brass inlay and a dark teal felt surface; a few face-down cards and small brass coin stacks on the
table; tall dark teal panelled walls with faint civic banners (no readable text) dissolving into
darkness. Single dim warm overhead light pooling on the table. The CENTER and upper-center of the
frame must be calm, dark and low-detail (the logo and menu buttons sit there). No people, no text,
no letters, no logos. Same screen-printed gouache texture as the references. The tall version is a
separate composition made for a phone (table lower third, calm upper two-thirds), not a crop.
