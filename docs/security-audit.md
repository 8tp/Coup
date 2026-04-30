# Security Audit Report: Coup Online

**Last Updated:** April 2026
**Audited State:** `origin/dev` release-candidate state
**Status:** Major socket/game hardening complete; no high/critical npm audit findings remain

---

## Current Posture

The project keeps the most important security property intact: the server is authoritative for deck state, hidden cards, timers, phase transitions, and outcomes. Clients send intents and receive filtered state through `StateSerializer`.

Recent hardening in `dev` has addressed the highest-risk findings from the previous audit:

- Production Socket.io CORS now rejects cross-origin connections when `CORS_ORIGIN` is unset.
- Express sets security headers, including frame denial, nosniff, referrer policy, HSTS in production, and a production CSP.
- `server.set('trust proxy', 1)` is configured.
- Room create/join, bot add, and game action socket paths are rate-limited.
- Chat and reactions are rate-limited and bounded.
- Socket payloads are validated for action enum values, target types, block characters, bot personalities, settings shape, exchange indices, influence-loss indices, and examine decisions.
- Room rejoin now requires the player's random session token.
- Room codes, session tokens, deck shuffle, starting player, timeout target selection, faction-start selection, and Inquisitor hidden-card selection use Node crypto randomness.
- Player, bot, chat, and spectator IDs use Node `crypto.randomUUID()`; the external `uuid` package has been removed.
- Vite is pinned to `7.3.2`, clearing the previous high-severity Vite dev-server advisories.
- Names and chat messages are sanitized and profanity-checked by `ContentFilter`.

---

## Verification Snapshot

- `npm test`: 550 tests passed across 21 files.
- `npm run test:e2e`: socket browser-flow E2E passed for create/join/start/action/rematch.
- `npm run build`: production Next.js build and server TypeScript build passed.
- `npm audit`: 2 moderate findings remain. Both are the current Next.js package's nested PostCSS advisory; `npm audit fix --force` suggests a breaking downgrade to `next@9.3.3`, so it is not an acceptable automatic fix.
- Dependabot triage: React, React DOM, Zustand, Autoprefixer, direct PostCSS, and Vitest updates were safe to apply. Tailwind 4 fails the current PostCSS setup as-is, and Next 16 passes build/tests in a temporary copy but does not clear the nested Next/PostCSS advisory, so both should stay separate follow-up PRs.

---

## Resolved Findings

| Original Priority | Finding | Current Status |
|-------------------|---------|----------------|
| P0 | Permissive production CORS | Resolved. Production uses `process.env.CORS_ORIGIN || false`; missing config rejects cross-origin connections. |
| P0 | Missing security headers | Mostly resolved. Manual Express middleware sets the important headers and a production CSP. |
| P1 | `Math.random()` for deck shuffle/room codes/starting player/timeout target | Resolved for game-critical server randomness. Remaining `Math.random()` uses are bot behavior, client UI convenience, tests, and scripts. |
| P1 | Vulnerable `uuid` dependency | Resolved by replacing it with Node `crypto.randomUUID()`. |
| P1 | Missing trust proxy config | Resolved with `server.set('trust proxy', 1)`. |
| P1 | No rejoin authentication | Resolved with per-player random session tokens checked on `room:rejoin`. |
| P2 | Rate limiting gaps | Mostly resolved for room create/join, bot add, gameplay events, chat, and reactions. |
| P2 | Socket input validation gaps | Mostly resolved at SocketHandler boundaries. |
| P2 | Missing CSP | Partially resolved. CSP exists in production, but still allows inline/eval for framework compatibility. |
| P3 | Bot personality/block character validation | Resolved. |

---

## Remaining Risks

### 1. CSP Is Still Permissive

**Severity:** Medium
**Files:** `server.ts`, `src/app/layout.tsx`

The production CSP includes `'unsafe-inline'` and `'unsafe-eval'`. This is common during Next.js integration, but it limits CSP's ability to contain XSS. The inline text-size bootstrap script in `layout.tsx` is hardcoded and low-risk, but it is still a blocker to a strict no-inline CSP.

**Recommended follow-up:** Move toward nonce/hash-based script allowance and test production builds under a stricter CSP.

### 2. Rejoin Token Storage Is Client-Readable

**Severity:** Medium
**Files:** `src/app/hooks/useSocket.ts`, `src/server/RoomManager.ts`

Session tokens materially improve rejoin security, but they are stored in `sessionStorage`. Any future XSS could still read `coup_session_token` and hijack a room session.

**Recommended follow-up:** Consider httpOnly same-site cookies or short-lived HMAC session proofs if room/session security needs to withstand XSS.

### 3. Gameplay Rate Limits Are Per Socket

**Severity:** Medium
**Files:** `src/server/SocketHandler.ts`

Gameplay events share a 500ms per-socket limiter. This prevents accidental double-click floods but does not replace deployment-level IP/edge rate limiting against many sockets or distributed clients.

**Recommended follow-up:** Add platform/edge rate limits and consider per-IP connection caps if the deployment is public.

### 4. Production CORS Fails Closed But Does Not Fail Startup

**Severity:** Low
**File:** `server.ts`

If `CORS_ORIGIN` is missing in production, the server warns and rejects cross-origin Socket.io connections. This is safe, but operationally easy to miss.

**Recommended follow-up:** Fail startup in production when `CORS_ORIGIN` is missing, or document the deployment environment variable prominently.

### 5. Next.js Nested PostCSS Audit Advisory

**Severity:** Medium
**Files:** `package-lock.json`

`npm audit` still reports a moderate PostCSS advisory through Next.js' nested `postcss@8.4.31`. The suggested forced fix downgrades Next.js to `9.3.3`, which is not viable for this app. Direct project `postcss` is updated to a patched version, and the remaining advisory should be monitored for a patched Next.js release.

**Recommended follow-up:** Re-run `npm audit` before release and update Next.js when a compatible patched version is available.

### 6. In-Memory Rooms And Local Stats

**Severity:** Low
**Files:** `src/server/RoomManager.ts`, `src/app/stores/statsStore.ts`

Rooms are in memory and player stats live in browser `localStorage`. This is acceptable for the current no-account model, but restarts clear active rooms and stats are not portable across browsers/devices.

**Recommended follow-up:** Use Redis or another shared store before running multiple server instances.

---

## Good Findings

- Hidden cards and deck contents are filtered by `StateSerializer`.
- Exchange and Examine private state are sent only to the acting player.
- Spectator state never exposes unrevealed cards.
- Socket IDs and session tokens are stripped from room broadcasts.
- Room host-only actions are checked server-side.
- Bots use public game state through the same engine API and do not receive socket-only privileges.
- Chat history is capped to 50 messages and message length is capped to 200 characters.
- Room cleanup covers both 24-hour TTL and abandoned in-progress games with no connected humans.

---

## Before Main Push

Run:

```bash
npm audit --audit-level=high
npm test
npm run build
```

`npm audit` without an audit level currently reports the known moderate Next.js/PostCSS advisory described above.

Then smoke-test:

- Private create/join/start/game-over/rematch with two browser sessions.
- Public room browser join flow.
- Public live-game spectator flow.
- Reformation with Inquisitor: Convert, Embezzle, Examine, and same-faction target restrictions.
