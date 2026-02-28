# Product Requirements Document (PRD): Web-Based Coup

**Project Name:** WebCoup (or Coup Online)  
**Version:** 1.0 (MVP)  
**Date:** February 2026  
**Author:** Grok (research-based)  
**Target Users:** Fans of social deduction games who want to play Coup with friends remotely or locally.  
**Primary Focus:** Mobile-first (portrait orientation, touch-friendly), fully responsive for desktop.  
**Scope:** Faithful digital adaptation of the base **Coup** card game (2012 rules by Rikki Tahta / La Mame Games / Indie Boards & Cards). No expansions initially.

## 1. Product Overview & Vision
Coup is a fast-paced (15 min) bluffing / social deduction game for 2–6 players. Players control two secret character influences and use coins to eliminate opponents through actions, claims, challenges, and blocks.

**Vision:** A polished, real-time web app that captures the tension, bluffing, and table-talk of the physical game. Clean, modern UI with smooth animations, instant feedback, and zero setup friction. Works seamlessly on phones (primary) and desktops. Play with friends via shareable room codes — no accounts required for MVP.

**Business Goals**
- Delight players so they return and share rooms.
- 100% rule-accurate (server-authoritative to prevent cheating).
- Easy for Claude (or any LLM) to implement iteratively.

**Success Metrics (MVP)**
- 3–6 players can complete a full game without rule errors.
- Responsive on iOS/Android Chrome/Safari (portrait primary).
- < 2s latency for actions on good connections.

## 2. Game Rules Summary (Authoritative for Implementation)
**Components (digital equivalents)**
- 15 character cards: 3× Duke, Assassin, Captain, Ambassador, Contessa.
- Court Deck (remaining cards after deal).
- Coins (visual stack or counter per player + central treasury).
- Each player: 2 face-down influences + coin count.

**Setup**
- 2–6 players (recommend 3–6; optional 2-player variant noted).
- Shuffle deck, deal 2 face-down influences per player.
- Each player starts with 2 coins.
- Random starting player (or host chooses).

**Player Turn (one action only)**
1. **Income** – +1 coin (safe).
2. **Foreign Aid** – +2 coins (blockable by Duke).
3. **Coup** – Pay 7 coins, force target to lose 1 influence (mandatory if ≥10 coins at start of turn; unblockable/un-challengeable).
4. **Character claims** (must declare character):
   - **Duke (Tax)**: +3 coins.
   - **Assassin (Assassinate)**: Pay 3 coins, force target to lose 1 influence (blockable by Contessa).
   - **Captain (Steal)**: Take 2 coins from target (or all if <2; blockable by Captain/Ambassador).
   - **Ambassador (Exchange)**: Draw 2 from Court Deck. Mix with your current influences. Return exactly 2 cards to deck (you keep the same number of face-down influences). Shuffle deck.
   - **Contessa**: Only used for blocking assassination.

**Challenges & Blocks (real-time sequential prompts)**
- After any claim, **any** player can **Challenge** (“I think you’re bluffing!”).
  - Challenged player must reveal the claimed card if they have it → return revealed card to Court Deck → shuffle → draw replacement (face-down). Challenger loses 1 influence.
  - If they don’t have it (or refuse) → challenged player loses 1 influence. Action/counter fails (coins refunded).
- For blockable actions, any player (usually target) can **Block** by claiming the blocking character → then the original actor can Challenge the block.
- Challenges resolve **before** any block or action.
- Loser of any challenge/block always chooses which of their face-down influences to flip face-up permanently (revealed to all, no longer usable).

**Losing Influence**
- Flipped face-up, stays visible in front of player.
- If last influence lost → player eliminated immediately (coins returned to treasury, cards stay face-up).

**End Game**
- Last player with ≥1 influence wins.
- Game auto-ends and shows winner + stats.

**Exact Edge Cases (must implement)**
- Player with 1 influence doing Exchange: draws 2 → temporarily holds 3 → chooses 1 to keep face-down, returns 2.
- Steal from player with 1 coin → steal 1.
- Successful challenge on action → action fully cancelled, coins back.
- 10+ coins → must Coup (UI forces it).

## 3. User Personas & User Stories
**Primary Persona:** “Mobile Friend Group” – 20–35yo, plays on phone during Discord calls or family gatherings. Wants quick room creation and smooth touch controls.

**Key User Stories (MVP)**
- As a player I can create a room with 6-digit code and share link.
- As a player I can join via code or link (guest name entry).
- As a player I see real-time player list, coins, and face-up influences.
- As active player I see large action buttons and target selectors (tap players).
- As any player I can instantly Challenge/Block/Pass with big prominent buttons and 15–30s timers (configurable).
- As player I see my private hand (large, tappable cards) + animations (flip, slide coins, reveal).
- As spectator (future) or eliminated player I can watch with chat.

## 4. Core Features & Screens (Mobile-First)

**Tech UI Guidelines**
- Tailwind CSS + responsive (mobile portrait first: max 480px wide layout).
- Large touch targets (≥48px).
- Dark theme with vibrant card art (use SVG icons or simple emoji placeholders initially; later AI-generated or public domain art).
- Smooth CSS/Framer-Motion style animations (card flips, coin counters, confetti on win).
- PWA support (installable on homescreen).

**Main Screens/Flows**
1. **Home/Landing** – “Play Coup” button, rules quick-view, “Create Room”, “Join Room”.
2. **Lobby** – Room code, player list (names + ready status), host controls (start when 3–6 ready), chat sidebar (collapsible on mobile).
3. **Game Table** (core view)
   - Circular/seated table layout (your seat at bottom on mobile).
   - Opponent areas: name, coin stack (animated), 1–2 card slots (face-down or face-up revealed).
   - Center: Court Deck count + treasury coin pile.
   - Bottom panel (your area): Your 1–2 large face-down cards (tap to view), coin count, action bar.
   - Action log (scrollable, timestamped, collapsible on mobile).
   - Floating action buttons when it’s your turn.
4. **Action Modals/Prompts** (full-screen on mobile)
   - Choose action → select target (if needed) → confirm claim.
   - “X claims Duke for Tax” banner → Challenge / Pass buttons for everyone.
   - Block prompt for eligible players.
   - Exchange screen: private view of your cards + drawn cards → drag/drop or tap to choose which 2 to return.
   - Reveal animation (challenge resolution).
5. **Game Over** – Winner celebration, full stats (most challenges won, etc.), “Play Again” (same room).

**Accessibility**
- High contrast, screen-reader friendly labels, keyboard navigation fallback.

## 5. Multiplayer & Technical Requirements
**Multiplayer Architecture (Server-Authoritative)**
- Real-time via WebSockets (Socket.io recommended for simplicity).
- Backend manages full game state: deck (shuffled array), each player’s hidden influences, coins, turn order, pending actions.
- Clients receive only:
  - Public info (coins, face-up cards, current turn, log).
  - Own private hand.
- Reconnection handling (player can rejoin same room).
- Host can kick or restart.

**Suggested Tech Stack (Claude-friendly)**
- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind + Zustand or React Context for local state + Socket.io-client.
- **Backend:** Node.js + Express + Socket.io (or Supabase/Firebase for zero-server hassle).
- **Deployment:** Vercel (frontend) + Render/ Railway / Supabase (backend) — free tier sufficient.
- **State Persistence:** In-memory for MVP (restart on server crash); later Redis.
- **No database needed** for MVP (rooms in memory with 24h TTL).

**Performance**
- <100ms action broadcast.
- Offline detection + reconnect.

## 6. Non-Functional Requirements
- Cross-browser: latest Chrome, Safari, Firefox, Edge.
- Mobile: iOS 16+, Android 10+.
- Security: No cheating possible (server hides cards); rate-limit joins.
- Localization: English only (MVP).
- Analytics: Optional (room completion rate).

## 7. Out of Scope (MVP)
- Accounts / friends list / matchmaking.
- AI opponents.
- Expansions (Reformation, Rebellion).
- Voice chat / video integration.
- Monetization / ads.
- Spectators (watch-only).

## 8. Future Enhancements (Post-MVP)
- Reformation expansion.
- Bots (simple rule-based or LLM).
- Custom card art / themes.
- Statistics dashboard.
- Private rooms with passwords.
- Sound effects & music toggle.

## 9. Implementation Roadmap for Claude
1. **Phase 1:** Rules engine (pure JS/TS class for Game, Player, Deck, Action resolution).
2. **Phase 2:** Local hotseat mode (test all rules).
3. **Phase 3:** Socket.io multiplayer + rooms.
4. **Phase 4:** Mobile-first UI + animations.
5. **Phase 5:** Polish (log, timers, confetti, PWA).

**Appendix: Card Visuals Suggestion**
- Use simple colored borders + role icons (Duke = crown, Assassin = dagger, etc.).
- Or generate with Grok Imagine / DALL·E later.
- Face-up cards show full art + name.

**Rules Reference Links (for verification)**
- Official-style rulebook summaries used above.