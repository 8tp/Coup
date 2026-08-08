# Security Audit Report: Coup Online

**Last Updated:** August 2026
**Audited State:** `main` after the Next.js 16.3 upgrade
**Status:** Major socket/game hardening complete; `npm audit` reports no known vulnerabilities

---

## Current Posture

The project keeps the most important security property intact: the server is authoritative for deck state, hidden cards, timers, phase transitions, and outcomes. Clients send intents and receive filtered state through `StateSerializer`.

Recent hardening on `main` has addressed the highest-risk findings from the previous audit:

- Production Socket.io CORS now rejects cross-origin connections when `CORS_ORIGIN` is unset.
- Express sets security headers, including frame denial, nosniff, referrer policy, HSTS in production, and a production CSP.
- `server.set('trust proxy', 1)` is configured.
- Room create/join, bot add, and game action socket paths are rate-limited.
- Chat and reactions are rate-limited and bounded.
- Socket payloads are validated for action enum values, target types, block characters, bot personalities, settings shape, exchange indices, influence-loss indices, Examine selections, and Examine decisions.
- Room rejoin now requires the player's random session token.
- Room codes, session tokens, deck shuffle, starting player, timeout target selection, and faction-start selection use Node crypto randomness.
- Player, bot, chat, and spectator IDs use Node `crypto.randomUUID()`; the external `uuid` package has been removed.
- Vite resolves to a patched 7.3.x release, clearing the previous high-severity dev-server advisories.
- Names and chat messages are sanitized and profanity-checked by `ContentFilter`.

---

## Verification Snapshot

- `npm test`: 588 tests passed across 22 files.
- `npm run test:e2e`: all 15 socket browser-flow E2E tests passed.
- `npm run typecheck`: app, custom server, tests, and maintenance scripts pass strict TypeScript checks.
- `npm run build`: the production Next.js 16.3 build and server TypeScript build pass.
- `npm audit`: 0 known vulnerabilities.
- Dependabot triage: patch/minor updates continue automatically; Express, Tailwind, Vite, and TypeScript majors remain dedicated migrations rather than mechanical dependency bumps.

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

### 5. In-Memory Rooms And Local Stats

**Severity:** Low
**Files:** `src/server/RoomManager.ts`, `src/app/stores/statsStore.ts`

Rooms are in memory and player stats live in browser `localStorage`. This is acceptable for the current no-account model, but restarts clear active rooms and stats are not portable across browsers/devices.

**Recommended follow-up:** Use Redis or another shared store before running multiple server instances.

---

## Good Findings

- Hidden cards and deck contents are filtered by `StateSerializer`.
- Exchange details and the examined card are sent only to the acting player; pending Examine target selection contains no card data.
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
