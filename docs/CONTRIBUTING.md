# Contributing to Coup Online

Thank you for your interest in contributing to Coup Online! This document provides guidelines and information to help you get started.

---

## Reporting Bugs

If you find a bug, please open a GitHub issue with the following information:

1. **Summary** -- a clear, concise description of the bug
2. **Steps to reproduce** -- numbered steps to trigger the issue
3. **Expected behavior** -- what you expected to happen
4. **Actual behavior** -- what actually happened
5. **Environment** -- browser, OS, device type (mobile/desktop), Node.js version
6. **Screenshots** -- if applicable, include screenshots or screen recordings

Please search existing issues before creating a new one to avoid duplicates.

---

## Suggesting Features

Feature suggestions are welcome! Open a GitHub issue with the label `enhancement` and include:

1. **Problem statement** -- what problem does this feature solve?
2. **Proposed solution** -- describe the feature and how it would work
3. **Alternatives considered** -- any other approaches you thought about
4. **Additional context** -- mockups, links to similar implementations, etc.

---

## Development Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm (comes with Node.js)
- Git

### Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/your-username/coup-online.git
cd coup-online

# Install dependencies
npm install

# Start the development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

The development server runs at `http://localhost:3000` with hot reloading for both the Next.js frontend and the Express/Socket.io backend (via `tsx`).

### Project Layout

- `docs/` -- project documentation (CONTRIBUTING.md, PRD.md)
- `tests/` -- test suite mirroring `src/` structure (`tests/engine/`, `tests/server/`)
- `src/shared/` -- types, constants, and protocol definitions shared between client and server
- `src/engine/` -- pure game logic with no I/O dependencies (start here if working on rules)
- `src/server/` -- Socket.io handlers, room management, state serialization
- `src/app/` -- Next.js App Router pages, components, hooks, and stores
- `server.ts` -- application entry point wiring Express, Socket.io, and Next.js

---

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled (`strict: true` in `tsconfig.json`)
- Use explicit types for function parameters and return values in shared/engine code
- Prefer `interface` over `type` for object shapes
- Use `enum` for fixed sets of values (see `Character`, `ActionType`, `TurnPhase`)

### General Conventions

- Use descriptive variable and function names
- Keep functions focused -- single responsibility
- Engine code (`src/engine/`) must remain pure: no timers, no I/O, no Socket.io references. Side effects are expressed as data (`SideEffect[]`) and applied by the `GameEngine`
- Shared types go in `src/shared/types.ts`; do not import server-only or client-only code into shared modules
- All game constants (costs, timers, player limits) live in `src/shared/constants.ts`

### File Naming

- React components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Stores: `camelCaseStore.ts`
- Engine/server classes: `PascalCase.ts`

### Styling

- Use Tailwind CSS utility classes for all styling
- Follow the existing dark theme and color conventions
- Touch targets must be at least 48px for mobile usability

---

## Pull Request Process

1. **Create a branch** from `main` with a descriptive name:
   - `feature/add-spectator-mode`
   - `fix/steal-zero-coins-crash`
   - `refactor/extract-timer-logic`

2. **Make your changes** with clear, focused commits

3. **Run tests** and make sure they pass:
   ```bash
   npm test
   ```

4. **Test manually** with at least 2 browser tabs to verify multiplayer behavior

5. **Open a Pull Request** against `main` with:
   - A clear title summarizing the change
   - A description of what changed and why
   - Screenshots or recordings for UI changes
   - Notes on any edge cases tested

6. **Address review feedback** -- maintainers may request changes before merging

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Tested with multiple players in the browser
- [ ] No console errors or warnings in the browser
- [ ] Game rules remain accurate (if engine code changed)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior by opening an issue.

---

## Questions?

If you have questions about contributing, feel free to open a discussion or issue on GitHub. We are happy to help!
