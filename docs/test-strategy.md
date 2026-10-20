<!-- This file is about the booking management test strategy and which test pyramid layer each case uses. -->
# EventHub - Booking Management Test Strategy

Source: `docs/test-scenarios.md` (80 scenarios, TC-001..TC-514). Role: Test Strategist.
Decision rules: pure function/no I/O = Unit; backend business rule or API contract = API; single component render/UI state = Component; multi-page full-stack journey = E2E; push down when possible; when in doubt, the lowest adequate layer.

## 1. Reality check: what can run today

| Layer | Runner in repo? | Realistic today? | How |
|---|---|---|---|
| E2E | Yes, Playwright (`npm run test`, Chromium) | Yes | `tests/booking-management.spec.js` (6 tests) |
| API | No dedicated runner | Yes, cheaply | Playwright `request` fixture against `http://localhost:3001/api` (JWT from `POST /api/auth/login`). Same `npx playwright test`, no new dependency |
| Component | None (no Jest/Vitest/RTL/Playwright CT) | Not as true component tests | Interim: Playwright page tests with `page.route()` mocks of `/api/bookings*` (what TC-512/513/514 already say). Target: add Vitest + React Testing Library |
| Unit | None | Partly | `randomRef`/`generateUniqueRef` are module-private in `bookingService.js` (only `bookingService` is exported), so TC-110/405/408 need an export or a refactor into `utils/bookingRef.js`, plus a runner (Vitest/node:test). Until then, TC-408 is verifiable via API and TC-110/405 are not verifiable |

So the target pyramid below is the design; the "Runnable today" column in section 3 says what can be written now.

## 2. Distribution (target)

| Layer | Count | Share | Focus | Est. run time |
|---|---|---|---|---|
| Unit | 3 | 4% | Booking-ref generation (format, collision fallback, digit prefix) | < 1 s |
| API | 46 | 57% | Auth, ownership, FIFO pruning, seats, validation, pagination, error codes, defects | ~1-2 min (0.3 s each + seeding up to 9 bookings) |
| Component | 22 | 28% | Loading/empty/error/403/404 branches, dialogs, refund state machine, stepper, badge | ~30 s (interim Playwright+mocks ~1-2 min) |
| E2E | 9 | 11% | Critical journeys: book-to-list, detail, cancel, clear-all, refund happy path, cross-user denial | ~4 min (each = login + seed + action; refund waits 4 s) |
| Total | 80 | 100% | | ~7-8 min |

Pyramid shape is healthy on paper (E2E 11%). Current repo state is the opposite: see section 5.

## 3. Layer assignment for every TC

Source refs: `bS` = `backend/src/services/bookingService.js`, `bC` = `controllers/bookingController.js`, `bV` = `validators/bookingValidator.js`, `bR` = `repositories/bookingRepository.js`, `aM` = `middleware/authMiddleware.js`, `routes` = `routes/bookingRoutes.js`, `FE-list` = `frontend/app/bookings/page.tsx` (`BookingsContent`), `FE-detail` = `frontend/app/bookings/[id]/page.tsx`.

### Happy path

| TC | Layer | Source under test | Runnable today |
|---|---|---|---|
| TC-001 | E2E | `GET /api/bookings` -> `bC.getBookings` -> `FE-list` + `BookingCard.jsx` | Yes (exists) |
| TC-002 | E2E | `bS.getBookingById`, `FE-detail` | Yes (exists) |
| TC-003 | E2E | `DELETE /api/bookings/:id` -> `bS.cancelBooking`, `FE-detail.handleCancel` | Yes (exists; also covers TC-506) |
| TC-004 | E2E | `DELETE /api/bookings` -> `bS.clearAllBookings`, `FE-list.handleClearAll` | Yes (exists) |
| TC-005 | E2E | `FE-detail` back button. Fold into TC-002 as a final step, not a separate test | Yes |
| TC-006 | E2E | Booking confirmation -> `/bookings` navigation (events page `View My Bookings`) | Yes (exists) |
| TC-007 | API | `GET /api/bookings/ref/:ref` -> `bS.getBookingByRef` | Yes |
| TC-008 | API | `bR.findAll` `orderBy createdAt desc` | Yes |
| TC-009 | Component | `FE-detail` Badge from `booking.status` | Interim mocked |

### Business rules

| TC | Layer | Source under test | Runnable today |
|---|---|---|---|
| TC-100 | API | `bS.createBooking` prune branch, `bR.findOldestUserBookingExcludingEvent` | Yes |
| TC-101 | API | `bS.createBooking` `sameEventFallback` -> `eventRepository.decrementSeats` | Yes |
| TC-102 | API | `bS.randomRef` via `POST /api/bookings` response. Existing E2E version kept as is, see 4.2 | Yes |
| TC-103 | E2E | `RefundEligibility` (inline in `FE-detail`; location unverified) with real booking, qty 1 | Yes |
| TC-104 | Component | `RefundEligibility` qty > 1 branch | Interim mocked |
| TC-105 | Component | `RefundEligibility` `setTimeout(4000)`; use fake clock (`page.clock`) | Interim mocked |
| TC-106 | API | `bS.createBooking` `totalPrice = parseFloat(event.price) * quantity` | Yes |
| TC-107 | API | `bS.getBookings` default `limit = 10` | Yes |
| TC-108 | API | `cancelBooking` + `eventService.withPersonalSeats` / `bR.getBookedQuantitiesForEvents` | Yes |
| TC-109 | Component | `FE-list` clear link when `bookings.length > 0` | Interim mocked |
| TC-110 | Unit | `generateUniqueRef` / `randomRef` (private; needs export) | No (needs refactor + runner) |
| TC-111 | API | `eventService.withPersonalSeats`, `bR.getBookedQuantitiesForEvents` | Yes (needs 2 users) |
| TC-112 | API | `bS.cancelBooking` (no `incrementSeats`) vs swagger text. Flagged, see 6 | Yes |
| TC-113 | API | `bR.findOldestUserBookingExcludingEvent` (`eventId not`, `createdAt asc`) | Yes |

### Security

| TC | Layer | Source under test | Runnable today |
|---|---|---|---|
| TC-200 | E2E | Full chain: `bS.getBookingById` ForbiddenError -> `FE-detail` `is403` -> "Access Denied" | Yes (needs 2 accounts) |
| TC-201 | API | `bS.getBookingById` (`booking.userId !== userId`) | Yes |
| TC-202 | API | `bS.cancelBooking`. Conflicts with code (404 not 403), see 6 | Yes, but would fail as written |
| TC-203 | API | `aM` via `GET /api/bookings` | Yes |
| TC-204 | API | `aM` via `GET /api/bookings/:id` | Yes |
| TC-205 | API | `aM` via `DELETE /api/bookings` | Yes |
| TC-206 | API | `bS.getBookingByRef` ownership | Yes |
| TC-207 | API | `bS.cancelBooking` + `bR.findById(id, userId)`. Suspected defect | Yes |
| TC-208 | API | `eventRepository.findById(id, userId)` via `bS.createBooking` | Yes |
| TC-209 | API | `aM` (all booking routes via `router.use`) | Yes |
| TC-210 | API | `bS.getBookingByRef` NotFoundError before ownership check | Yes |

### Negative / error

| TC | Layer | Source under test | Runnable today |
|---|---|---|---|
| TC-300 | Component | `FE-detail` not-found `EmptyState` (non-403 error) | Interim mocked |
| TC-301 | API | `bS.getBookingById` NotFoundError | Yes |
| TC-302 | API | `bS.createBooking` `InsufficientSeatsError` | Yes |
| TC-303 | API | `bS.createBooking` NotFoundError (event) | Yes |
| TC-304 | API | `bV.validateCreateBooking` required fields | Yes |
| TC-305 | API | `bV` quantity `isInt({min:1})` | Yes |
| TC-306 | API | `bV` quantity `isInt({max:10})` | Yes |
| TC-307 | API | `bS.cancelBooking` second call | Yes |
| TC-308 | Component | `FE-list` `isError` branch (mock 500) | Interim mocked |
| TC-309 | API | `bS.createBooking` prune before `eventRepository.findById`. Suspected defect | Yes |
| TC-310 | API | `bS.createBooking` prune before seat check. Suspected defect | Yes |
| TC-311 | API | `bV` phone rules vs `app/events/[id]/page.tsx` digit check. See contested table | Yes (API half) |
| TC-312 | API | `bV` customerName `isLength({min:2})`, no max | Yes |
| TC-313 | API | `bV` quantity `notEmpty().isInt().toInt()` | Yes |
| TC-314 | API | `bS.getBookings` `Number(x) \|\| default` | Yes |
| TC-315 | API | `bC.clearAllBookings` response shape. Conflicts with TC-406 | Yes |
| TC-316 | API | `bR.findById/findByIdOnly` `Number(id)`. Suspected defect | Yes |
| TC-317 | API | `bS.getBookings` + `bR.findAll` negative skip/take. Suspected defect | Yes |

### Edge cases

| TC | Layer | Source under test | Runnable today |
|---|---|---|---|
| TC-400 | API | Same as TC-100. Merge into one parametrized test | Yes |
| TC-401 | API | Same as TC-101. Merge | Yes |
| TC-402 | API | `bV` quantity lower bound + `totalPrice`; UI default of 1 is already exercised by every `bookEvent` call | Yes |
| TC-403 | API | `bV` quantity upper bound (10). Stepper cap is TC-411 | Yes |
| TC-404 | Component | `RefundEligibility` boundary qty 2 | Interim mocked |
| TC-405 | Unit | `generateUniqueRef` collision loop (stub `findByRef`) | No (needs refactor + runner) |
| TC-406 | API | `bC.clearAllBookings` with 1 booking. Conflicts with code, see 6 | Yes, expectation must change |
| TC-407 | API | `bS.getBookings` page 2, limit 5 | Yes |
| TC-408 | Unit | `randomRef` digit prefix. API fallback needs an event titled with a digit (create one via `/api/events`) | API fallback only |
| TC-409 | API | `bS.createBooking` `count >= MAX_USER_BOOKINGS` boundary | Yes |
| TC-410 | API | `bS.createBooking` zero-seat rejection. "SOLD OUT" label is a UI branch, not covered by any assigned test (gap, see 7) | Yes |
| TC-411 | Component | `maxQty = Math.min(10, availableSeats)` in `app/events/[id]/page.tsx` | Interim mocked |
| TC-412 | API | `bS.getBookings` `totalPages = ceil(total/limit)` | Yes |

### UI state

| TC | Layer | Source under test | Runnable today |
|---|---|---|---|
| TC-500 | Component | `FE-list` `isLoading` skeletons (delay mocked response) | Interim mocked |
| TC-501 | Component | `FE-list` empty branch | Interim mocked |
| TC-502 | Component | `FE-detail` `isLoading` spinner | Interim mocked |
| TC-503 | Component | `ConfirmDialog.jsx` content (already asserted incidentally by TC-003) | Interim |
| TC-504 | Component | `FE-detail` `onClose` sets `confirm=false`; assert no DELETE sent | Interim |
| TC-505 | Component | Breadcrumb renders `booking.bookingRef` (already asserted by TC-002) | Interim |
| TC-506 | E2E | `handleCancel.onSuccess`. Covered by TC-003; do not write separately | Yes (exists) |
| TC-507 | Component | `FE-list` `clearing` state (delay mocked DELETE) | Interim mocked |
| TC-508 | Component | `RefundEligibility` idle -> checking -> result | Interim mocked |
| TC-509 | Component | `FE-detail` `error.status === 403` branch (mock 403). Real-stack proof is TC-200 | Interim mocked |
| TC-510 | Component | `Pagination.jsx` + `FE-list` `?page=N` (mock `totalPages: 2`; unreachable with real data because of the 9 cap) | Interim mocked |
| TC-511 | Component | `FE-list.handleClearAll` `confirm()` dismissed, assert no request | Interim mocked |
| TC-512 | Component | `booking.status === 'confirmed' &&` guard (mock status) | Interim mocked |
| TC-513 | Component | `handleCancel.onError` toast + dialog close (mock 500) | Interim mocked |
| TC-514 | Component | `handleClearAll` try/finally without catch. Suspected defect | Interim mocked |

## 4. Contested assignments (rationale)

| TC | Candidates | Chosen | Rationale |
|---|---|---|---|
| TC-102 | E2E (existing) vs API vs Unit | API | The rule lives in `randomRef` and surfaces in the `POST /api/bookings` body. Needs no browser. E2E duplicate is kept only because it already exists and checks UI-to-API ref propagation, but should not be extended |
| TC-103 vs TC-104/404 | E2E vs Component vs Unit | 103 E2E; 104, 404 Component | Refund rule is client-side only (qty === 1), so no API can cover it. Rule is critical, so one real full-stack happy path stays at E2E (defense in depth). Other branches and the boundary are render logic of one component, so push down. Ideal long term: extract `isRefundEligible(qty)` as a Unit |
| TC-105 | E2E vs Component | Component | The 4 s timer wait costs 4 s per E2E run; a fake clock makes it instant |
| TC-200 vs TC-509 | E2E vs Component | Both, different jobs | 200 proves the real 403 reaches the UI as "Access Denied" (security-critical). 509 covers the `is403` branch with a mock and is the cheap regression guard |
| TC-300 | E2E vs Component | Component | Non-403 error branch of `FE-detail`; API 404 is TC-301 |
| TC-308, TC-500, TC-502, TC-507 | E2E (needs throttling/killing backend) vs Component | Component | State rendering only. E2E would need to stop the backend or throttle; flaky |
| TC-311 | API vs Component vs Unit | API | The server rule is the contract. The client digit-count check in `app/events/[id]/page.tsx` is a separate pure function; add a small Component/Unit check there if the validator is ever extracted. Mismatch itself is a design decision, flagged below |
| TC-400/401 vs TC-100/101 | API (duplicates) | API, merged | Same code path and expectations; one parametrized test each |
| TC-402/403 | E2E vs API | API | Quantity bounds are `bV` rules; UI stepper cap is TC-411. Happy path with qty 1 already runs in every E2E |
| TC-405, TC-408 | Unit vs API | Unit | Requires stubbing `findByRef` / no DB. Not runnable until refs are exported (section 1) |
| TC-410 | API vs E2E | API | Seat rule at `bS.createBooking`. UI "SOLD OUT" is a Component branch of `EventCard`; no TC owns it, listed as gap |
| TC-406 | E2E vs API | API | TC-004 already covers the UI. The response body is the contract and the scenario expectation is wrong (see 6) |
| TC-510 | E2E vs Component | Component | A capped user (9 bookings, page size 10) can never reach page 2 with real data, so only a mock can render pagination |
| TC-512/513/514 | E2E-mocked vs Component | Component | They are component behaviour with mocked network anyway; the labels "E2E (mocked)" in the scenarios are really component tests |
| TC-503/504/505 | E2E vs Component | Component | Already asserted along the way inside TC-003/TC-002; stand-alone E2E would only repeat login+seed cost |

## 5. Anti-patterns found in `tests/booking-management.spec.js`

| # | Anti-pattern | Where | Fix |
|---|---|---|---|
| 1 | Ice-cream cone: all 6 tests are E2E; 0 API, 0 component, 0 unit | whole file | Add the API suite first (46 TCs, cheap) |
| 2 | Pure/business logic at E2E | TC-102 (ref prefix rule via full UI booking) | Move to API (`POST /api/bookings`) or Unit |
| 3 | No E2E for critical flows that are missing | Refund eligibility (TC-103), cross-user Access Denied (TC-200) have no test | Add both as E2E |
| 4 | Setup through the UI | `login()` and `clearBookings()` repeated in every test; `bookEvent()` runs the full UI form to create state | Log in via `POST /api/auth/login` and seed via `POST /api/bookings`; keep UI only for the flow under test |
| 5 | Locators violate priority (data-testid > role > label > ID > CSS class) | `span.font-mono.font-bold`, `.booking-ref`, `.confirm-booking-btn`, `#login-btn`, `#confirm-dialog-yes`, `#check-refund-btn` | Prefer `getByTestId`/role where the app exposes them; add `data-testid` where missing (assumes app change) |
| 6 | Duplicated flow code | TC-006 re-implements `bookEvent` inline | Reuse helper or API seed |
| 7 | Tests overlap and bundle | TC-003 also asserts TC-503 and TC-506; TC-001 and TC-002 both create their own booking | Acceptable for E2E, but record the bundling in the traceability table (done above) |
| 8 | Shared mutable account | All tests use `rahulshetty1@gmail.com` and wipe all bookings; parallel workers would collide | Serial mode or unique users per worker |
| 9 | Hard-coded production URL and credentials | `BASE_URL = 'https://eventhub.rahulshettyacademy.com'` | Read from `playwright.config.ts` `baseURL`/env (config file not inspected, unverified) |
| 10 | `console.log` noise, first-available-event dependency | `bookEvent`, TC-102 | Remove logs; pick or create a known event |
| 11 | Assertion fragility | TC-002 `getByText('Test User')` and `getByText(eventTitle).first()` can match several nodes | Scope to the section locator |

Conventions check: no `waitForTimeout` is used (good); step comments are present (good).

## 6. Flagged items: suspected defects and doc/code conflicts

| TC | Item | Evidence | Action |
|---|---|---|---|
| TC-207 | Cross-user DELETE returns 404, while GET returns 403 | `bS.cancelBooking` calls `bR.findById(id, userId)`, which filters by owner, so the `ForbiddenError` line is dead code | Write the test to document observed 404; file a defect or decide the intended contract |
| TC-202 | Expects 403 on cross-user DELETE; code gives 404 | Same as above | Change expectation or fix code. Do not ship as written |
| TC-406 | Expects `{ deleted: 1 }`; endpoint returns `{ success, message: "1 booking(s) cleared" }` | `bC.clearAllBookings` | Update expectation (assert on message); TC-315 already states the real shape |
| TC-309 | Failed booking (unknown event) still deletes the oldest booking | Prune precedes `eventRepository.findById`; no transaction | Defect: move validation before prune or wrap in `prisma.$transaction` |
| TC-310 | Insufficient-seats rejection still deletes oldest booking and can change the seat check outcome | Prune precedes seat check | Same fix |
| TC-316 | Non-numeric id likely 500 | `Number("abc")` = NaN into Prisma; no route-level id validation | Confirm live; add `param('id').isInt()` validator |
| TC-317 | Negative `page`/`limit` likely 500 or negative `totalPages` | `Number("-1") \|\| 1` stays -1 | Confirm live; clamp in `bS.getBookings` |
| TC-514 | "Clear all" has no catch/error message | `FE-list.handleClearAll` try/finally only | Defect; compare with cancel flow (TC-513) |
| TC-112 | Burned seats are not restored on cancel, contradicting swagger "atomically restores the released seats" | `bS.cancelBooking` has no `incrementSeats` | Decide intended behaviour; fix docs or code |
| TC-311 | Client requires 10 digits, server accepts 10 punctuation characters | `bV` vs `app/events/[id]/page.tsx` | Align rules |
| TC-210 / TC-206 | 403 vs 404 lets a caller confirm that a ref exists | `bS.getBookingByRef` | Security note, low severity |
| TC-314 | Swagger documents `limit` max 100; code has no cap | `bS.getBookings` | Align |

Defect-flagged tests should be written against the observed behaviour, tagged `@defect`, and kept (or `test.fail()`) until resolved, not silently dropped.

## 7. Defense in depth for critical rules

| Rule | Unit | API | Component | E2E | Gap |
|---|---|---|---|---|---|
| Max 9 bookings, FIFO prune (`MAX_USER_BOOKINGS`) | - | TC-100, 101, 113, 400, 401, 409 | - | - | Prune-before-validate defects (TC-309/310) have no guard until fixed. Not E2E-worthy |
| Booking ref prefix = event title first char | TC-110, 408 | TC-102 | - | TC-102 (existing, redundant) | Unit not runnable yet |
| Refund eligibility (qty === 1) | (suggest extracting `isRefundEligible`) | none (client-side only) | TC-104, 105, 404, 508 | TC-103 | No server enforcement; rule can only be tested client side |
| Cross-user access denied | - | TC-201, 202, 206, 207, 208 | TC-509 | TC-200 | TC-202/207 contract disagrees |
| Authentication on booking routes | - | TC-203, 204, 205, 209 | - | implicit in every E2E login | None |
| Seat accounting (per-user seats, burn on fallback) | - | TC-108, 111, 112, 302, 410 | TC-411 | - | UI "SOLD OUT" label has no assigned test |
| Cancel booking | - | TC-307, 202/207 | TC-503, 504, 513 | TC-003 (+506) | None |
| Clear all | - | TC-205, 315, 406 | TC-507, 511, 514 | TC-004 | None |
| Validation (qty 1-10, phone, name, email) | - | TC-304, 305, 306, 311, 312, 313 | - | none (correct) | Email format-invalid case is not in the scenarios (gap) |

## 8. Recommended build order

1. API suite in `tests/api/bookings.api.spec.js` using `request` fixture (46 TCs; start with security and FIFO). Biggest risk reduction per hour.
2. Add the two missing E2E tests (TC-103, TC-200); refactor existing E2E setup to API seeding.
3. Interim component-style tests with `page.route()` for TC-512/513/514, TC-509, TC-104/404.
4. Introduce Vitest (+RTL) and export the ref helpers; then move Component and Unit tests across.

## 9. Not verified

- Scenarios were taken as written; line-level claims about the frontend (`RefundEligibility` location, `EventCard`, `app/events/[id]/page.tsx`) were not re-read here beyond file existence. `RefundEligibility` is not a separate file under `frontend/components`; assumed inline in `FE-detail`.
- `playwright.config.ts` and the `.claude/skills/eventhub-domain/*.md` files were not reviewed in depth for this write-up.
- No test was run against a live server; all defect flags come from code reading.
- Time estimates are rough.
