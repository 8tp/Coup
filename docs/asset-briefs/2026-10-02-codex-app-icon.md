# Coup Online — app icon / favicon brief (use the $imagegen skill, built-in image_gen tool)

Make the app icon and favicon for "Coup Online", matching the NEW branding:
- ref-new-wordmark.png: the new wordmark — crisp crimson-enamel condensed COUP capitals with an aged-brass
  edge/inline, ONLINE on a slim brass plate.
- ref-new-back.png: the new card back — calm blackened-teal field, thin brass double-rule border, one
  brass eight-point rosette in the centre.
- ref-current-icon.png: the OLD icon being replaced (red/grey split V in a circle). Do not copy it.

Palette: blackened teal (#0B1513, #17231F), crimson enamel (#8A1F2B, #A8323A), aged brass (#D6A12A),
bone (#F1EBDE). Screen-printed flat graphic look; nothing glows; no 3D chrome, no photorealism, no gradients
beyond a faint vignette.

Hard requirements (it must work as a 16x16 and 32x32 browser favicon AND a 512x512 home-screen icon):
- Square 1:1, 1024x1024, full bleed (the teal background fills the whole square — no transparent corners,
  no rounded-square plate, no drop shadow, no mockup).
- ONE bold central mark filling ~70% of the canvas, with strong value contrast against the background.
  Minimal fine texture inside the mark (texture turns to mush at 16 px). No thin hairlines that vanish small.
- Centered, symmetric where the motif allows, comfortably inside the central 80% circle (it will also be
  used as a maskable icon).
- No words. A single letter C is allowed only in variant a/c.

Generate 3 variants, one built-in image_gen call each:
- icon-a.png: a monogram "C" drawn in the wordmark's style — condensed geometric capital with a sharp
  asymmetric cut, crimson enamel face, brass edge — on the blackened-teal field.
- icon-b.png: the brass eight-point rosette from the card back, large and bold, inside a thin brass ring,
  on the blackened-teal field (maybe a small crimson centre).
- icon-c.png: the crimson "C" monogram wrapping around a small brass rosette in its counter.

After generating, COPY each from $CODEX_HOME/generated_images/... into THIS folder with those exact names.
Then build sheet.html showing each at 16, 32, 64, 180 and 512 px on both a dark (#202124) and light (#f1f3f4)
browser-tab-like background, render it to sheet.png if you can, and write RESULTS.md (file, size, one line
on how it differs, and your honest read of 16 px legibility).
