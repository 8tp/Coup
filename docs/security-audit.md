# Security Audit Report: Coup Online

**Date:** 2026-03-02
**Audited by:** Claude Code
**Status:** Pending remediation

---

## Dependency Scan

- `npm audit`: **0 vulnerabilities**
- `.env` properly gitignored
- No hardcoded secrets found in source

---

## CRITICAL Issues

### 1. Permissive CORS in Production

**File:** `server.ts:29`
**Risk:** Any website can establish WebSocket connections to the server, enabling cross-site WebSocket hijacking.

If `CORS_ORIGIN` env var is unset, defaults to `true` (allows any origin):

```typescript
origin: dev ? '*' : (process.env.CORS_ORIGIN || true),
```

**Fix:** Require `CORS_ORIGIN` to be explicitly set; fail loudly if missing in production.

---

### 2. No Security Headers

**File:** `server.ts`
**Risk:** Clickjacking, MIME-sniffing, XSS amplification.

No `helmet` middleware. Missing `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`.

**Fix:** `npm install helmet` and add `app.use(helmet())`.

---

### 3. `Math.random()` for Deck Shuffle and Other Randomness

**Files:**
- `src/engine/Deck.ts:21-27` -- Fisher-Yates shuffle
- `src/engine/Game.ts:46` -- starting player selection
- `src/server/RoomManager.ts:25-35` -- room code generation
- `src/engine/GameEngine.ts:266` -- timeout target selection

**Risk:** `Math.random()` is not cryptographically secure. V8's xorshift128+ is non-trivial to predict remotely, but for a card game where hidden information matters, this is a design weakness.

**Fix:** Replace with `crypto.randomInt()` or `crypto.getRandomValues()`.

---

## HIGH Issues

### 4. No Socket.io Session Authentication

**File:** `src/server/SocketHandler.ts:114-152`
**Risk:** If a playerId is leaked (e.g., via XSS), an attacker could hijack a session by calling `room:rejoin` with the stolen roomCode + playerId.

`room:rejoin` only validates that roomCode + playerId exist, with no cryptographic proof the socket owns that player:

```typescript
socket.on('room:rejoin', (data, callback) => {
  const code = data.roomCode?.trim().toUpperCase();
  if (!code || !data.playerId) { ... }
  const result = this.roomManager.rejoinRoom(code, data.playerId, socket.id);
});
```

**Mitigating factor:** playerId is a UUID (practically unguessable).

**Fix:** Issue a signed session token (JWT or HMAC) on join, require it on rejoin.

---

### 5. Missing Trust Proxy Configuration

**File:** `server.ts`
**Risk:** Behind a reverse proxy (Cloudflare, nginx), all connections appear from the same IP, breaking per-IP rate limiting. Attackers can also spoof `X-Forwarded-For` headers.

`SocketHandler.ts:24-35` extracts IPs from `X-Forwarded-For` / `CF-Connecting-IP` for rate limiting, but Express is not configured to trust proxy headers.

**Fix:** Add `app.set('trust proxy', 1)` in `server.ts`.

---

### 6. Rate Limiting Gaps

**File:** `src/server/SocketHandler.ts`
**Risk:** DoS via flooding. The engine rejects invalid actions but still burns CPU processing them.

Chat and reactions are rate-limited, but these are **not**:
- `room:create` / `room:join` -- room creation spam
- `game:action` / `game:challenge` / `game:block` -- rapid-fire game actions
- `bot:add` -- bot spam

**Fix:** Implement per-socket or per-IP rate limiting for all socket events.

---

### 7. Missing Input Validation at Socket Layer

**Files:**
- `src/server/SocketHandler.ts:432` -- `game:block`: `data.character` not validated against `Character` enum
- `src/server/SocketHandler.ts:408` -- `game:action`: `data.targetId` type not validated (could be object/number)
- `src/server/SocketHandler.ts:192` -- `bot:add`: `data.personality` not validated against `BotPersonality` enum values

**Risk:** The engine catches invalid values downstream, but defense-in-depth says validate at the boundary.

**Fix:** Add enum/type validation before passing data to the engine.

---

## MEDIUM Issues

### 8. No Content Security Policy

**Risk:** Without CSP, the application is more vulnerable to inline script injection and external script loading.

No CSP headers configured in Next.js or Express. Additionally, `layout.tsx:55-57` uses `dangerouslySetInnerHTML` (hardcoded and safe today, but a risky pattern).

**Fix:** Add CSP headers via `next.config.ts` headers config or helmet.

---

### 9. Session Data in sessionStorage

**File:** `src/app/hooks/useSocket.ts:54-55`
**Risk:** If XSS is achieved, `coup_room` and `coup_player` can be exfiltrated to hijack sessions (ties into issue #4).

**Fix:** Consider memory-only storage or signed httpOnly cookies.

---

### 10. Client-Side Player Name Validation

**File:** `src/app/page.tsx:161-168`
**Risk:** Low -- server validates via `validateName()`, but the client only enforces `maxLength={20}` with no character restrictions.

**Fix:** Add client-side regex validation to match server rules.

---

## LOW Issues / Good Findings

**Things done well (no action needed):**
- Server-authoritative architecture -- clients cannot cheat on game logic
- `StateSerializer` properly hides opponent cards and deck contents
- Exchange state only sent to the exchanging player
- Socket IDs stripped from broadcasts
- Chat bounded to 50 messages, 200 chars max
- Room cleanup: 24h TTL + 120s inactive cleanup
- Player limits enforced (2-6)
- Bot brain does not peek at hidden state
- React JSX auto-escapes rendered text (chat messages, player names are not XSS-vulnerable)
- Authorization checks on host-only operations (start, rematch, settings, bots)
- No race conditions in disconnect/reconnect flow
- Proper disconnect timer management

---

## Priority Fix List

| Priority | Issue | Effort | Status |
|----------|-------|--------|--------|
| **P0** | Set explicit CORS origin in production | 5 min | TODO |
| **P0** | Add helmet middleware | 10 min | TODO |
| **P1** | Replace `Math.random()` with `crypto.randomInt()` | 30 min | TODO |
| **P1** | Add trust proxy configuration | 2 min | TODO |
| **P1** | Add session tokens for rejoin auth | 1-2 hrs | TODO |
| **P2** | Rate limit all socket events | 1 hr | TODO |
| **P2** | Add input validation to all socket handlers | 30 min | TODO |
| **P2** | Add CSP headers | 30 min | TODO |
| **P3** | Validate bot personality, block character at socket layer | 15 min | TODO |
| **P3** | Add client-side name validation | 10 min | TODO |
