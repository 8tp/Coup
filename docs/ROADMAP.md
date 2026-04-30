# Coup Online Roadmap

This roadmap captures user-facing improvements worth considering after the current main release. The game is already in a solid release-candidate state: the highest-value work now is polish that reduces confusion, improves table feel, and makes it easier for new players to get into a game.

## Release Position

Ready for main:

- Core Classic and Reformation flows are implemented.
- Private/public rooms, spectators, rematch, reconnect, bots, chat, reactions, sound, haptics, and stats are present.
- Server-authoritative game logic and per-player state serialization are covered by the existing test suite.

Do not block the current main push on:

- Accounts, ranked play, matchmaking, or persistent cloud profiles.
- Tailwind 4 migration.
- Next 16 migration.
- 7-10 player Reformation deck scaling.

Started in the current release-readiness branch:

- Clearer lobby room-code and invite-link copy feedback.
- More specific unavailable-action and invalid-target explanations.
- Named waiting cues and browser-title attention states for key game phases.
- Always-reachable rules shortcuts in the lobby and game.
- A compact latest-event strip and expandable "why did this happen?" log explanations.
- Richer game-over recap cards for winner standing, decisive moment, biggest coin move, bluff table, and challenge reads.
- Card replacement/deal movement and animated coin movement on player seats and the local hand.
- Staged post-game truth reveal, showing the winning hand before the rest of the table.
- Explicit reduced-animation setting in the Settings modal.
- First-time practice flow tucked into main menu settings, creating a disposable private bot game.
- Reformation quick-start guide covering faction markers, Convert, Embezzle, and Inquisitor.
- Shareable post-game recap export from the final table state and full action log.
- Host lobby moderation for removing players or spectators before start.
- Local per-player mute for chat and reactions.
- Accessibility pass for dialog semantics, card keyboard access, focus-visible styling, screen-reader labels, and non-color faction markers.
- PWA install prompt plus production asset caching for core icons, table backgrounds, and card art.
- Socket browser-flow E2E coverage for create/join/start/action/rematch, spectators, reconnect, Reformation, rematch authorization, and lobby moderation.

## Near-Term User Niceties

These are small enough to ship incrementally and have direct player value.

### Lobby And Sharing

- Add a host-only "shuffle bot personalities" action before start.
- Keep room setup compact and focused on the player list, sharing controls, and settings people actually change at the table.

### Turn Clarity

- Highlight who is expected to respond during challenge/block/influence-loss/exchange phases.
- Show "waiting for..." names in the center prompt instead of only showing the phase.
- Add disabled-action explanations in the action bar, especially for forced Coup, faction restrictions, and insufficient coins.
- Show the exact block/challenge window countdown near the decision buttons.
- Add a subtle "your turn" browser title change and notification sound variant.

### Learning And Onboarding

- Add a guided in-game coaching overlay for the first practice match.
- Add a full Reformation walkthrough scenario that demonstrates a faction block, Convert, Embezzle, and Examine in sequence.

### Table Feel

- Add a post-game reveal option for manually stepping through each player's final hand.

### Mobile Ergonomics

- Add a one-hand action sheet for targeting actions on narrow screens.
- Let players tap a target seat first, then pick an available targeted action.
- Keep the current player's own cards, coins, and available actions sticky on mobile.
- Audit long player names and chat messages on small screens to prevent layout pressure.

### Social And Safety

- Add host controls to remove disconnected lobby players in bulk before start.
- Add a small set of neutral quick-chat phrases for players who do not want free-form chat.
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
- Friendlier bot-fill flow when a human disconnects mid-game.
- Inquisitor Examine rule parity where the target chooses which card is examined.
- 7-10 player Reformation support with the larger deck composition.

## Technical Follow-Ups

- Move reconnect/session proof from session storage to an httpOnly same-site cookie.
- Tighten the Content Security Policy by removing inline script/style allowances.
- Add IP or edge-level rate limits for public deployments.
- Move room state to Redis or another shared store before multi-instance deployment.
- Keep Dependabot minor/patch PRs flowing, but handle framework/tooling majors in dedicated branches.
