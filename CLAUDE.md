<!-- This file is about guidance for Claude Code when working in this repository. -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

EventHub is a full-stack event ticket booking platform (Next.js frontend + Express/Prisma/MySQL backend) used for QA training. The actively developed part of this repo is the **Playwright E2E suite in `tests/`**, which runs against the deployed site `https://eventhub.rahulshettyacademy.com` (see `baseURL` in `playwright.config.ts`) — not against a local stack.

## Commands

```bash
npm run setup        # install deps in backend/ and frontend/ (root deps: npm ci / npm install)
npm run dev          # backend (:3001) + frontend (:3000) via concurrently
npm run db:push      # push Prisma schema to MySQL (non-interactive); `npm run migrate` is interactive
npm run seed         # seed 10 static events
npm run build        # build frontend
npm run lint         # lint frontend (next lint)

npm test                                              # all Playwright tests (Chromium only, html reporter)
npm run test:ui                                       # Playwright UI mode
npx playwright test tests/<file>.spec.js --reporter=line   # single file
npx playwright test -g "<test title>"                 # single test by title
npm run test:report                                   # open last HTML report
```

Local run needs `backend/.env` (`DATABASE_URL`, `PORT`, `CORS_ORIGIN`) and `frontend/.env.local` (`NEXT_PUBLIC_API_URL=http://localhost:3001/api`); see README.md. Swagger UI is at `http://localhost:3001/api/docs`. To point tests at a local stack, change `baseURL` in `playwright.config.ts`.

Docker: `docker-compose up --build` runs only the Playwright suite (image copies just `tests/` and `playwright.config.ts`; no app code).

CI (`.github/workflows/playwright.yml`) runs the suite on push to `main` against the live site, with `continue-on-error`, and uploads `playwright-report/`. `ci.yml` and `deploy.yml` also exist.

## Architecture

- `backend/`: layered Express API — `routes/ → controllers/ → services/ → repositories/ (Prisma) → MySQL`, with `validators/` (express-validator), `middleware/` (JWT auth, error handler, request logger) and `utils/errors.js`. `app.js` builds the app; `server.js` boots it. Schema and seed live in `backend/prisma/`.
- `frontend/`: Next.js 14 App Router (`app/`: admin, bookings, events, login, register), React Query v5, Tailwind; API clients/hooks in `lib/`, types in `types/`.
- `tests/`: Playwright specs, `<feature-name>.spec.js` (JavaScript, not TypeScript). `fullyParallel: false`, no retries, 30s timeout.
- `docs/`: `test-scenarios.md` and `test-strategy.md` (outputs of the scenario/strategy skills).

## Domain rules that affect tests

- Each user is sandboxed; cross-user booking access returns "Access Denied".
- Max 6 user-created events and max 9 bookings per user; overflow prunes the oldest (FIFO).
- Seeded (static) events are immutable.
- Booking ref's first character is the event title's first character, uppercased.
- Seats decrease on booking and are restored on cancellation.
- Refund eligibility is client-side: 1 ticket eligible, >1 not.
- Test account: `rahulshetty1@gmail.com` / `Magiclife1!`.

## Test conventions

- Locator priority: `data-testid` > role > label/placeholder > ID > CSS class.
- No `page.waitForTimeout()`; use web-first assertions (`expect().toBeVisible()`).
- Tests are self-contained (login → action → assert); add step comments.

## Project skills (`.claude/skills/`)

Consult before writing or reviewing tests: `eventhub-domain` (business rules, API reference, UI selectors, user flows) and `playwright-best-practices`. Workflow skills: `generate-tests`, `review-tests`, `create-scenarios`, `test-strategy`.
