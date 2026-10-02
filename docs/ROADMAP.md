# Coup Online Roadmap

This roadmap captures user-facing improvements worth considering after the current v1 release. The game is live and feature-complete for its current 2-6 player scope; the highest-value work now is polish that reduces confusion, improves table feel, and makes it easier for new players to get into a game.

## Release Position

Shipped on `main`:

- Core Classic and Reformation flows are implemented.
- Private/public rooms, spectators, rematch, reconnect, bots, chat, reactions, sound, haptics, and stats are present.
- Server-authoritative game logic and per-player state serialization are covered by the existing test suite.

Do not block the current main push on:

- Accounts, ranked play, matchmaking, or persistent cloud profiles.
- Tailwind 4 migration.
- 7-10 player Reformation deck scaling.

Included in the current release:

- Clearer lobby room-code and invite-link copy feedback.
- More specific unavailable-action and invalid-target explanations.
- Named waiting cues and browser-title attention states for key game phases.
- Always-reachable rules shortcuts in the lobby and game.
- A compact latest-event strip and practice-only expandable "why did this happen?" log explanations.
- Richer game-over recap cards for winner standing, decisive moment, biggest coin move, bluff table, and challenge reads.
- Card replacement/deal movement and animated coin movement on player seats and the local hand.
- A mastered court-intrigue gameplay loop, independent music/SFX controls, automatic cue ducking, and generated endgame stingers.
- Staged post-game truth reveal, showing the winning hand before the rest of the table.
- Explicit reduced-animation setting in the Settings modal.
- First-time practice flow tucked into main menu settings, creating a disposable private bot game.
- Lightweight contextual coaching during practice for claims, challenges, blocks, influence loss, exchange decisions, and Coup timing.
- Reformation quick-start guide covering faction markers, Convert, Embezzle, and Inquisitor.
- Interactive Reformation walkthrough plus guided Reformation bot practice with faction, Convert, Embezzle, and Inquisitor coaching.
- Shareable post-game recap export from the final table state and full action log.
- Host lobby moderation for removing players or spectators before start.
- Local per-player mute for chat and reactions.
- Accessibility pass for dialog semantics, card keyboard access, focus-visible styling, screen-reader labels, and non-color faction markers.
- PWA install prompt plus production asset caching for core icons, table backgrounds, card art, and audio.
- Socket browser-flow E2E coverage for create/join/start/action/rematch, spectators, reconnect, Reformation, rematch authorization, and lobby moderation.

## Shipped October 2026

- **Funnel:** one-tap Play vs Bots, Fill seats, remembered names, a 45 s lobby reconnect grace, finished rooms joinable, instant bot replacement for leavers and AFK replacement for idlers.
- **Measurement:** structured `[metric]` log lines, optional Postgres game log with `GET /api/stats`, Cloudflare Web Analytics unblocked in the CSP.
- **The court table:** an oval table with seats on the rim in turn order, a claim plaque in the middle of the felt, coin flights, fallen-card pile, and a log drawer; on phones every decision lives in a bottom sheet in the thumb zone (the one-hand action sheet), with your hand and actions always on screen.
- **Table talk:** chat on screen beside the hand on desktop, quick-chat phrases, chat spoken at the seat.
- **Brand:** heraldic character emblems, new card back, wordmark, favicon/app icons, menu chamber art and social previews (Codex imagegen; briefs in `docs/asset-briefs/`).
- **Audio:** recorded ElevenLabs sound bank in measured loudness tiers and a context-aware soundtrack.
- **Menus:** rebuilt home and lobby; enamel-slab buttons; every dialog fits the viewport.
- **Design QA:** automated audit of every screen state at 360×640, 390×844 and 1440×900 — 44 px targets, nothing covered, nothing off-screen, no text under 11 px.
- **Security:** Next.js 16.3.8 (critical advisory), session token required on every rejoin.

## Near-Term User Niceties

These are small enough to ship incrementally and have direct player value.

### Lobby And Sharing

- Add a host-only "shuffle bot personalities" action before start.
- Keep room setup compact and focused on the player list, sharing controls, and settings people actually change at the table.

### Turn Clarity

- Continue testing phase and action clarity with first-time players, especially around the difference between challenging a claim and blocking an action.
- Tune contextual practice tips based on observed confusion rather than turning practice into a scripted walkthrough.

### Learning And Onboarding

- Playtest the Reformation walkthrough and guided bot game with first-time expansion players, then tune the sequence and coach timing around observed confusion.

### Table Feel

- Add a post-game reveal option for manually stepping through each player's final hand.

### Mobile Ergonomics

- Let players tap a target seat first, then pick an available targeted action.
- Audit long player names and chat messages on small screens to prevent layout pressure.

### Social And Safety

- Add host controls to remove disconnected lobby players in bulk before start.
- Add a "table tone" setting for bot reactions: quiet, normal, spicy.

### Accessibility

- Add keyboard shortcuts for common actions, pass, challenge, block, and reveal.
- Add automated accessibility smoke checks for modal/action flows.
- Add screen-reader labels for timer state and remaining decision deadlines.

## Post-Main Product Features

These are useful, but they have broader design or infrastructure implications.

- Expand browser-flow E2E coverage to include spectator promotion and public room browsing filters.
- Optional persistent user profile with game history and cosmetic preferences.
- Public room directory filters for mode, player count, and spectators allowed.
- Custom rule presets: timers, starting coins, bots allowed, open spectators, and Reformation options.
- 7-10 player Reformation support with the larger deck composition.

## Technical Follow-Ups

- Move reconnect/session proof from session storage to an httpOnly same-site cookie.
- Tighten the Content Security Policy by removing inline script/style allowances.
- Add IP or edge-level rate limits for public deployments.
- Move room state to Redis or another shared store before multi-instance deployment.
- Keep Dependabot minor/patch PRs flowing, but handle framework/tooling majors in dedicated branches.
