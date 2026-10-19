# EventHub — Booking Management Test Scenarios

Generated: 2026-03-06 | Extended: 2026-10-19
Scope: Booking Management (Flow 4 — View, Cancel, Clear, Refund Eligibility), plus booking-creation side effects that touch the bookings list (FIFO pruning, per-user seats, validation)
Scenario count: 80 (Happy 9, Business 14, Security 11, Negative 18, Edge 13, UI State 15). TC-001..TC-510 are the original set; later IDs were added 2026-10-19 and every one was checked against the code.
Notes:
- "Suspected defect" scenarios describe behaviour confirmed by reading the code that contradicts a documented rule or is clearly unintended. They are not yet run against a live server.
- Page size vs cap: the bookings page requests `limit: 10` (API default also 10); the "9" in the domain docs is the per-user booking cap (`MAX_USER_BOOKINGS`). They are unrelated.
- Known doc/code mismatches in older scenarios: TC-202 expects 403 on cross-user DELETE, but the code returns 404 (see TC-207). TC-406 expects `{ deleted: 1 }`, but the endpoint responds with `{ success, message: "1 booking(s) cleared" }` (see TC-315).

---

## Happy Path

### TC-001: View bookings list with existing bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings`
2. Observe the list of booking cards rendered
**Expected Results**: Each booking card displays booking reference, event name, quantity, total price, and "View Details" link
**Business Rule**: Flow 4 — Manage Bookings
**Suggested Layer**: E2E

---

### TC-002: View single booking detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings`
2. Click "View Details" on any booking card
3. Observe the booking detail page at `/bookings/:id`
**Expected Results**: Page shows event details (title, date, venue, city, category), customer details (name, email, phone), payment summary (quantity, price per ticket, total paid), booking reference in breadcrumb and header, booking ID, and "Check eligibility for refund?" link
**Business Rule**: Booking model fields; Flow 4
**Suggested Layer**: E2E

---

### TC-003: Cancel a single booking from the detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings/:id`
2. Click "Cancel Booking" button
3. Confirm in the dialog by clicking "Yes, cancel it"
4. Observe redirect and bookings list
**Expected Results**: Success toast "Booking cancelled successfully" appears; user is redirected to `/bookings`; cancelled booking no longer appears in the list
**Business Rule**: Booking cancellation deletes the record; seats released for dynamic events
**Suggested Layer**: E2E

---

### TC-004: Clear all bookings from the bookings list page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one booking
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings" link
3. Confirm the browser confirm dialog
4. Observe the page after clearing
**Expected Results**: All bookings are removed; page shows empty state "No bookings yet" with "Browse Events" button
**Business Rule**: `DELETE /api/bookings` clears all user bookings; `clearAllBookings` service method
**Suggested Layer**: E2E

---

### TC-005: Navigate back to bookings list from detail page
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User is on a booking detail page
**Steps**:
1. Click "← Back to My Bookings" button at bottom of detail page
**Expected Results**: User is navigated to `/bookings`
**Business Rule**: UI navigation flow
**Suggested Layer**: E2E

---

### TC-006: Navigate to bookings via "View My Bookings" after completing a booking
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User just completed a booking (confirmation card shown)
**Steps**:
1. After booking confirmation, click "View My Bookings" link
2. Observe the bookings page
**Expected Results**: User lands on `/bookings` and the newly created booking appears in the list
**Business Rule**: Flow 3 → Flow 4 navigation
**Suggested Layer**: E2E

---

### TC-007: Lookup booking by reference via API
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is authenticated; user has a booking with known `bookingRef`
**Steps**:
1. Send `GET /api/bookings/ref/:ref` with valid JWT and own booking ref
**Expected Results**: 200 response with full booking data including nested event
**Business Rule**: `GET /api/bookings/ref/:ref` endpoint
**Suggested Layer**: API

---

### TC-008: Bookings list is ordered newest first
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is logged in; user has at least 2 bookings created at different times
**Steps**:
1. Note the booking refs in creation order
2. Navigate to `/bookings` (or send `GET /api/bookings`)
**Expected Results**: The most recently created booking is first; the oldest is last
**Business Rule**: `bookingRepository.findAll` — `orderBy: { createdAt: 'desc' }`
**Suggested Layer**: API / E2E

---

### TC-009: Booking detail shows a "confirmed" status badge and Cancel button
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is logged in; user has a new booking
**Steps**:
1. Navigate to `/bookings/:id`
2. Observe the header next to the booking reference
**Expected Results**: A badge reading "confirmed" is shown and the "Cancel Booking" button is visible
**Business Rule**: `createBooking` always sets `status: 'confirmed'`; detail page renders `booking.status` in a Badge
**Suggested Layer**: E2E

---

## Business Rules

### TC-100: FIFO pruning — 10th booking replaces oldest booking from a different event
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has exactly 9 bookings (all for different events); user has JWT token
**Steps**:
1. Note the oldest booking ID
2. Create a new booking (10th) for a different event via `POST /api/bookings`
3. Retrieve all user bookings
**Expected Results**: Total booking count remains 9; the oldest booking is deleted; the new booking is present
**Business Rule**: Max 9 bookings per user; FIFO pruning prefers deleting from a different event
**Suggested Layer**: API

---

### TC-101: FIFO pruning — same-event fallback permanently burns a seat
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has exactly 9 bookings all for the SAME event; enough seats remain
**Steps**:
1. Create a 10th booking for the same event
2. Retrieve the event's available seats
**Expected Results**: Oldest booking is deleted; new booking is created; `availableSeats` decremented by the new booking's quantity (seat permanently burned via `decrementSeats`)
**Business Rule**: `sameEventFallback` path in `bookingService.createBooking`
**Suggested Layer**: API

---

### TC-102: Booking reference first character matches event title first character
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User is logged in; event with known title exists (e.g., "Tech Conference Bangalore")
**Steps**:
1. Book the event
2. Read the `bookingRef` from the confirmation card or API response
**Expected Results**: `bookingRef` starts with the uppercase first character of the event title (e.g., "T-XXXXXX" for "Tech Conference")
**Business Rule**: `randomRef` function: prefix = `eventTitle[0].toUpperCase()`; Rule 7
**Suggested Layer**: E2E / API

---

### TC-103: Refund eligibility — single ticket booking is eligible
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has a booking with quantity = 1
**Steps**:
1. Navigate to `/bookings/:id` for the single-ticket booking
2. Click "Check eligibility for refund?"
3. Wait for spinner to disappear (4 seconds)
4. Read the refund result
**Expected Results**: `#refund-result` shows green "Eligible for refund. Single-ticket bookings qualify for a full refund."
**Business Rule**: Rule 8 — quantity === 1 → eligible
**Suggested Layer**: E2E

---

### TC-104: Refund eligibility — multi-ticket booking is NOT eligible
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has a booking with quantity > 1 (e.g., 3 tickets)
**Steps**:
1. Navigate to `/bookings/:id` for the multi-ticket booking
2. Click "Check eligibility for refund?"
3. Wait for spinner to disappear (4 seconds)
4. Read the refund result
**Expected Results**: `#refund-result` shows red "Not eligible for refund. Group bookings (3 tickets) are non-refundable." with correct quantity displayed
**Business Rule**: Rule 8 — quantity > 1 → not eligible
**Suggested Layer**: E2E

---

### TC-105: Refund eligibility spinner shows for approximately 4 seconds
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User is on a booking detail page
**Steps**:
1. Click "Check eligibility for refund?"
2. Immediately check for spinner
3. Observe when spinner disappears and result appears
**Expected Results**: `#refund-spinner` is visible immediately after clicking; spinner disappears and `#refund-result` appears after ~4 seconds
**Business Rule**: Rule 8 — `setTimeout(..., 4000)` in `RefundEligibility` component
**Suggested Layer**: E2E / Component

---

### TC-106: Total price is calculated as price × quantity
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User books an event with known price
**Steps**:
1. Book an event (e.g., price $1499, quantity 3)
2. View the booking detail page
**Expected Results**: "Total Paid" shows $4,497 (1499 × 3); `totalPrice` in API response equals `event.price × quantity`
**Business Rule**: Rule 9 — `totalPrice = event.price × quantity`
**Suggested Layer**: E2E / API

---

### TC-107: Bookings API defaults to a page size of 10 (distinct from the 9-booking cap)
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User is authenticated; user has at least one booking
**Steps**:
1. Send `GET /api/bookings` with no query params
2. Send `GET /api/bookings?page=1&limit=10`
**Expected Results**: Both responses include `pagination.limit = 10`, `pagination.page = 1`, `pagination.totalPages = ceil(total / 10)` and a `data` array with at most 10 items. Because of the 9-booking cap, `totalPages` is 1 in practice
**Business Rule**: `bookingService.getBookings` default `limit = 10`; the bookings page (`frontend/app/bookings/page.tsx`) requests `limit: 10`. The 9 in the domain docs is the per-user cap (`MAX_USER_BOOKINGS`, Rule 4), not a page size
**Suggested Layer**: API

---

### TC-108: Cancelling a booking releases seat count for dynamic events (computed)
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has a dynamic (user-created) event with a booking
**Steps**:
1. Note the current available seats for the event (computed: totalSeats - booked quantities)
2. Cancel the booking for that event
3. Re-fetch the event detail
**Expected Results**: Available seats increase by the cancelled booking's quantity
**Business Rule**: Rule 6 — dynamic events compute seats as `totalSeats - sum(user's booking quantities)`; cancellation removes the booking record
**Suggested Layer**: API / E2E

---

### TC-109: Bookings list shows "Clear all bookings" button whenever bookings exist
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User has at least one booking
**Steps**:
1. Navigate to `/bookings`
2. Look for "Clear all bookings" link
**Expected Results**: "Clear all bookings" link is visible in the top-right of the page header
**Business Rule**: Flow 4 — UI always shows clear option when bookings exist
**Suggested Layer**: E2E / Component

---

### TC-110: Booking reference format and 8-character fallback after 10 collisions
**Category**: Business Rule
**Priority**: P2
**Preconditions**: Unit-level control over `findByRef` (stub it to always return an existing booking)
**Steps**:
1. Call `generateUniqueRef("Sample Event")` with `findByRef` stubbed to always return a record
2. Call it again with `findByRef` returning null
**Expected Results**: Step 2 returns `S-` followed by exactly 6 characters from `A-Z0-9`. Step 1 makes 10 lookups, then returns `S-` followed by the last 8 characters of `Date.now()` in base36 uppercase (so 8 characters, not 6)
**Business Rule**: `randomRef` / `generateUniqueRef` in `bookingService.js` (loop `attempts < 10`, then `Date.now().toString(36).toUpperCase().slice(-8)`)
**Suggested Layer**: Unit

---

### TC-111: Available seats are per-user: `availableSeats` minus the user's own booked quantity
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Two synthetic users exist; both can see the same event with N seats
**Steps**:
1. User A books 3 tickets for the event
2. `GET /api/events/:id` as User A, then as User B
**Expected Results**: User A sees `N - 3`; User B still sees `N`. The value never goes below 0. This applies to static events as well as dynamic ones
**Business Rule**: `eventService.withPersonalSeats` and `bookingRepository.getBookedQuantitiesForEvents` — `Math.max(0, availableSeats - userBooked)`
**Suggested Layer**: API

---

### TC-112: Seats burned by the same-event FIFO fallback are not restored on cancellation
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User has 9 bookings for the same event (qty 1 each); the event has spare seats
**Steps**:
1. Note the event's DB `availableSeats` (or the per-user value)
2. Create a 10th booking (qty 2) for the same event, which triggers the fallback and `decrementSeats`
3. Cancel that new booking
4. Re-fetch the event
**Expected Results**: Cancel only deletes the row; `eventRepository.incrementSeats` is never called, so the 2 burned seats stay lost. This contradicts the swagger text on `DELETE /bookings/{id}` ("atomically restores the released seats")
**Business Rule**: `sameEventFallback` → `decrementSeats` in `createBooking`; `cancelBooking` has no increment (the comment says seats are computed dynamically)
**Suggested Layer**: API

---

### TC-113: FIFO pruning picks the oldest booking by `createdAt`, skipping bookings for the target event
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 9 bookings: the 2 oldest are for Event X, the rest for other events
**Steps**:
1. Create a new booking for Event X
2. List bookings
**Expected Results**: The oldest booking NOT for Event X is deleted (not the globally oldest); both older Event X bookings remain; count stays at 9; no seat is burned
**Business Rule**: `findOldestUserBookingExcludingEvent` (`eventId: { not }`, `createdAt asc`) is tried before `findOldestUserBooking`
**Suggested Layer**: API

---

## Security

### TC-200: Cross-user booking access returns "Access Denied" (UI)
**Category**: Security
**Priority**: P0
**Preconditions**: Two test accounts exist (rahulshetty1@gmail.com and rahulshetty1@yahoo.com); User A has a booking
**Steps**:
1. Log in as User A, create a booking, note the booking ID
2. Log out (clear localStorage JWT)
3. Log in as User B
4. Navigate to `/bookings/:userA_booking_id`
**Expected Results**: Page shows "Access Denied" title and "You are not authorized to view this booking." description
**Business Rule**: Rule 2 — cross-user access returns 403; frontend renders "Access Denied" on 403 response
**Suggested Layer**: E2E

---

### TC-201: Cross-user booking access returns 403 via API
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking; User B has a valid JWT
**Steps**:
1. Send `GET /api/bookings/:userA_booking_id` with User B's JWT
**Expected Results**: HTTP 403; response body contains "You are not authorized to view this booking"
**Business Rule**: `bookingService.getBookingById` — `booking.userId !== userId` → ForbiddenError
**Suggested Layer**: API

---

### TC-202: Cross-user booking cancellation returns 403 via API
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking; User B has a valid JWT
**Steps**:
1. Send `DELETE /api/bookings/:userA_booking_id` with User B's JWT
**Expected Results**: HTTP 403; booking is NOT deleted from the database
**Business Rule**: `bookingService.cancelBooking` — `booking.userId !== userId` → ForbiddenError
**Suggested Layer**: API

---

### TC-203: Unauthenticated access to bookings list returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No valid JWT
**Steps**:
1. Send `GET /api/bookings` without Authorization header
**Expected Results**: HTTP 401; "Unauthorized" error message
**Business Rule**: Auth middleware on all `/api/bookings` routes
**Suggested Layer**: API

---

### TC-204: Unauthenticated access to booking detail returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No valid JWT
**Steps**:
1. Send `GET /api/bookings/:id` without Authorization header
**Expected Results**: HTTP 401; "Unauthorized" error message
**Business Rule**: Auth middleware
**Suggested Layer**: API

---

### TC-205: Unauthenticated DELETE /api/bookings returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No valid JWT
**Steps**:
1. Send `DELETE /api/bookings` without Authorization header
**Expected Results**: HTTP 401
**Business Rule**: Auth middleware; `clearAllBookings` requires authenticated user
**Suggested Layer**: API

---

### TC-206: Cross-user booking lookup by ref returns 403
**Category**: Security
**Priority**: P1
**Preconditions**: User A has a booking with known ref; User B has a valid JWT
**Steps**:
1. Send `GET /api/bookings/ref/:userA_ref` with User B's JWT
**Expected Results**: HTTP 403; "You do not own this booking"
**Business Rule**: `bookingService.getBookingByRef` — ownership check
**Suggested Layer**: API

---

### TC-207: Suspected defect — cross-user DELETE returns 404, not 403 (contradicts TC-202)
**Category**: Security
**Priority**: P1
**Preconditions**: User A has a booking; User B has a valid JWT
**Steps**:
1. Send `DELETE /api/bookings/:userA_booking_id` with User B's JWT
2. Send `GET /api/bookings/:userA_booking_id` with User B's JWT for comparison
**Expected Results**: Observed in code: step 1 returns HTTP 404 "Booking with id X not found" because `cancelBooking` calls `findById(id, userId)`, which filters by owner, so the `ForbiddenError` branch is unreachable. Step 2 returns 403. The booking is not deleted. The two endpoints disagree, and TC-202 (expects 403) is wrong or the code is
**Business Rule**: Rule 2 — cross-user access returns "Access Denied" (403); `bookingService.cancelBooking` + `bookingRepository.findById(id, userId)`
**Suggested Layer**: API

---

### TC-208: Booking a dynamic event owned by another user returns 404
**Category**: Security
**Priority**: P1
**Preconditions**: User A has created a dynamic event; User B has a valid JWT
**Steps**:
1. Send `POST /api/bookings` as User B with valid fields and `eventId` = User A's event id
**Expected Results**: HTTP 404 "Event with id X not found"; no booking is created for User B
**Business Rule**: `eventRepository.findById(id, userId)` only matches `isStatic: true` or `userId` = caller
**Suggested Layer**: API

---

### TC-209: Missing or malformed Authorization header returns 401 on every booking route
**Category**: Security
**Priority**: P0
**Preconditions**: None
**Steps**:
1. Send `GET /api/bookings` with no header
2. Send it with `Authorization: Token abc` (no `Bearer ` prefix)
3. Send it with `Authorization: Bearer not.a.jwt`
4. Repeat for `POST /api/bookings`, `DELETE /api/bookings` and `DELETE /api/bookings/:id`
**Expected Results**: Steps 1-2: 401 `{ error: "Unauthorized" }`. Step 3 (and an expired or wrongly signed token): 401 `{ error: "Invalid or expired token" }`. No data is read or deleted
**Business Rule**: `authMiddleware` applied by `router.use` to all booking routes
**Suggested Layer**: API

---

### TC-210: Lookup by a reference that does not exist returns 404
**Category**: Security
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings/ref/Z-NOTREAL` with a valid JWT
**Expected Results**: HTTP 404 `Booking with reference "Z-NOTREAL" not found`, which is distinct from the 403 returned for another user's existing ref (TC-206). Note that the 403/404 difference lets a caller confirm that a ref exists
**Business Rule**: `bookingService.getBookingByRef` — NotFoundError before ownership check
**Suggested Layer**: API

---

## Negative / Error

### TC-300: Navigate to non-existent booking ID shows "Booking not found"
**Category**: Negative
**Priority**: P1
**Preconditions**: User is logged in
**Steps**:
1. Navigate to `/bookings/99999` (ID that does not exist)
**Expected Results**: Page shows "Booking not found" and "This booking doesn't exist or may have been cancelled." with "View My Bookings" button
**Business Rule**: `bookingService.getBookingById` throws NotFoundError → API returns 404; frontend renders not-found empty state
**Suggested Layer**: E2E

---

### TC-301: GET /api/bookings/:id with non-existent ID returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings/99999` with valid JWT
**Expected Results**: HTTP 404; error message "Booking with id 99999 not found"
**Business Rule**: `bookingService.getBookingById` — NotFoundError
**Suggested Layer**: API

---

### TC-302: Create booking with insufficient seats returns 400
**Category**: Negative
**Priority**: P0
**Preconditions**: User is authenticated; event has 0 personal available seats (all booked by this user)
**Steps**:
1. Send `POST /api/bookings` with `quantity: 1` for a fully-booked event
**Expected Results**: HTTP 400; "Only 0 seat(s) available, but 1 requested"
**Business Rule**: `bookingService.createBooking` — `InsufficientSeatsError` when `personalAvailable < quantity`
**Suggested Layer**: API

---

### TC-303: Create booking for non-existent event returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `eventId: 99999`
**Expected Results**: HTTP 404; "Event with id 99999 not found"
**Business Rule**: `bookingService.createBooking` — event lookup fails → NotFoundError
**Suggested Layer**: API

---

### TC-304: Create booking with missing required fields returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with missing `customerName`, `customerEmail`, or `customerPhone`
**Expected Results**: HTTP 400; validation error message listing missing fields
**Business Rule**: Input validators on the bookings route
**Suggested Layer**: API

---

### TC-305: Create booking with quantity = 0 or negative returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `quantity: 0`
2. Send `POST /api/bookings` with `quantity: -1`
**Expected Results**: HTTP 400; validation error for both cases
**Business Rule**: quantity must be 1–10 per booking model
**Suggested Layer**: API

---

### TC-306: Create booking with quantity > 10 returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `quantity: 11`
**Expected Results**: HTTP 400; validation error
**Business Rule**: quantity must be 1–10
**Suggested Layer**: API

---

### TC-307: Cancel a booking that has already been cancelled returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated; a booking exists
**Steps**:
1. Delete the booking via `DELETE /api/bookings/:id`
2. Attempt to delete the same booking again
**Expected Results**: HTTP 404; "Booking with id X not found"
**Business Rule**: `cancelBooking` uses `bookingRepository.findById` — not found after deletion
**Suggested Layer**: API

---

### TC-308: Bookings page shows error state when server is unreachable
**Category**: Negative
**Priority**: P2
**Preconditions**: Backend server is down or returns 500
**Steps**:
1. Navigate to `/bookings` with backend unavailable
**Expected Results**: Error empty state renders: "Couldn't load bookings", "Failed to connect to the server. Please try again.", and a "Retry" button
**Business Rule**: `isError` branch in `BookingsContent` component
**Suggested Layer**: Component / E2E

---

### TC-309: Suspected defect — failed booking for a non-existent event still deletes the oldest booking
**Category**: Negative
**Priority**: P1
**Preconditions**: User has exactly 9 bookings; note the oldest booking's id
**Steps**:
1. Send `POST /api/bookings` with valid fields and `eventId: 99999`
2. List bookings
**Expected Results**: Observed in code: step 1 returns 404, but the oldest booking has already been deleted, so the user is left with 8 bookings. Expected behaviour: a failed request should not change any data
**Business Rule**: In `createBooking` the FIFO prune (`bookingRepository.delete(oldest.id)`) runs before `eventRepository.findById`; no transaction wraps the steps
**Suggested Layer**: API

---

### TC-310: Suspected defect — booking rejected for insufficient seats still deletes the oldest booking
**Category**: Negative
**Priority**: P1
**Preconditions**: User has exactly 9 bookings; target event has fewer personal seats than the requested quantity
**Steps**:
1. Send `POST /api/bookings` requesting more seats than remain
2. List bookings
**Expected Results**: Observed in code: step 1 returns 400 "Only N seat(s) available, but Q requested", yet the oldest booking is gone (8 remain). If the oldest booking was for the same event, its quantity is freed first, which can make the seat check pass when it would otherwise fail
**Business Rule**: Prune precedes the seat check in `createBooking`; `getBookedQuantitiesForEvents` is read after the delete
**Suggested Layer**: API

---

### TC-311: Phone of 10 punctuation characters passes the API but is rejected by the UI
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated; event has seats
**Steps**:
1. Send `POST /api/bookings` with `customerPhone: "+-()+-()+-()"` (10 characters, no digits) and otherwise valid synthetic data
2. In the UI booking form, enter the same phone value
**Expected Results**: API: HTTP 201 (length >= 10 and only allowed characters; no digit is required). UI: error "Enter a valid 10-digit phone" because fewer than 10 digits remain after stripping non-digits. Client and server rules differ
**Business Rule**: `bookingValidator` `isLength({ min: 10 })` + `matches(/^[0-9+\-\s()]+$/)` vs `app/events/[id]/page.tsx` `replace(/\D/g, '').length < 10`
**Suggested Layer**: API / E2E

---

### TC-312: Customer name has a 2-character minimum and no maximum
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated; event has seats
**Steps**:
1. Send `POST /api/bookings` with `customerName: "A"`
2. Send it with a 2-character name
3. Send it with a 1,000-character name
**Expected Results**: Step 1: 400 "Customer name must be at least 2 characters". Step 2: 201. Step 3: 201 unless the DB column rejects it (then a 500 would mean the validator misses a limit; record the observed result). No upper-bound rule exists in the validator
**Business Rule**: `bookingValidator` — `isLength({ min: 2 })` only
**Suggested Layer**: API

---

### TC-313: Quantity of the wrong type or format
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated; event has seats
**Steps**:
1. Send `POST /api/bookings` with `quantity: 2.5`
2. Send it with `quantity: "abc"`
3. Send it with `quantity: "3"` (numeric string)
4. Send it with `quantity: null`, and with the field omitted
**Expected Results**: Steps 1, 2 and 4: 400 with `details` for field `quantity` ("Quantity is required" or "Quantity must be an integer between 1 and 10"). Step 3: accepted and coerced to the integer 3 (201). Zero, negatives and 11 are covered by TC-305/TC-306
**Business Rule**: `body('quantity').notEmpty().isInt({ min: 1, max: 10 }).toInt()`
**Suggested Layer**: API

---

### TC-314: Non-numeric `page` or `limit` falls back to defaults
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated; user has bookings
**Steps**:
1. Send `GET /api/bookings?page=abc&limit=xyz`
2. Send `GET /api/bookings?page=0&limit=0`
**Expected Results**: Both return 200 with `pagination.page = 1` and `pagination.limit = 10` (`Number(x) || default`). There is no upper cap on `limit` in the code, although swagger documents a maximum of 100
**Business Rule**: `bookingService.getBookings` — `Number(filters.page) || 1`, `Number(filters.limit) || 10`
**Suggested Layer**: API

---

### TC-315: Clear all with zero bookings succeeds and reports 0 cleared
**Category**: Negative
**Priority**: P2
**Preconditions**: User has no bookings
**Steps**:
1. Send `DELETE /api/bookings`
**Expected Results**: HTTP 200 `{ success: true, message: "0 booking(s) cleared" }`. The service returns `{ deleted: 0 }` internally, but the HTTP body has no `deleted` field (TC-406 assumes one). The UI shows the "No bookings yet" empty state
**Business Rule**: `bookingService.clearAllBookings` returns `{ deleted: count }`; `bookingController.clearAllBookings` maps it to a message string
**Suggested Layer**: API

---

### TC-316: Suspected defect — non-numeric booking id likely returns 500 instead of 400/404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings/abc` with a valid JWT
2. Send `DELETE /api/bookings/abc`
**Expected Results**: Expected: 400 or 404. From the code: `Number("abc")` is `NaN`, which Prisma rejects, so the global handler returns 500 (message shown outside production). Not run live, so confirm the status when executing
**Business Rule**: `bookingRepository.findByIdOnly` / `findById` use `Number(id)` with no route-level id validation
**Suggested Layer**: API

---

### TC-317: Suspected defect — negative `page` or `limit` is not validated
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings?page=-1`
2. Send `GET /api/bookings?limit=-5`
**Expected Results**: Expected: 400 or a fallback to defaults. From the code: `Number("-1") || 1` is -1 (truthy), so `skip` is negative and Prisma errors (500); a negative `limit` gives a negative `take` and a negative `totalPages`. Not run live, so record the observed behaviour
**Business Rule**: `getBookings` only falls back for falsy values (NaN or 0); `findAll` computes `skip = (page - 1) * limit`
**Suggested Layer**: API

---

## Edge Cases

### TC-400: Exactly 9 bookings — adding a 10th prunes oldest from a DIFFERENT event (preferred)
**Category**: Edge Case
**Priority**: P0
**Preconditions**: User has exactly 9 bookings across multiple events
**Steps**:
1. Note the ID of the oldest booking (different event from the new booking's event)
2. Create a new (10th) booking for Event X
3. Check the bookings list
**Expected Results**: Count stays at 9; oldest booking (different event) is gone; new booking is present
**Business Rule**: `findOldestUserBookingExcludingEvent` preferential pruning in `bookingService.createBooking`
**Suggested Layer**: API

---

### TC-401: Exactly 9 bookings all from same event — 10th triggers same-event fallback and burns seat
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has 9 bookings all for Event X
**Steps**:
1. Create a new booking for Event X (10th)
2. Re-fetch Event X's available seats
**Expected Results**: Oldest booking removed; new booking created; `availableSeats` is permanently decremented by the new quantity (seat burned via `eventRepository.decrementSeats`)
**Business Rule**: `sameEventFallback = true` → `decrementSeats` called in `bookingService.createBooking`
**Suggested Layer**: API

---

### TC-402: Booking with quantity = 1 (minimum) — full happy path
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is logged in; event has available seats
**Steps**:
1. Navigate to event detail page
2. Leave quantity at 1 (default minimum)
3. Fill customer form and confirm booking
**Expected Results**: Booking created with `quantity: 1`; `totalPrice = price × 1`; booking ref generated
**Business Rule**: quantity boundary: 1 is minimum
**Suggested Layer**: E2E

---

### TC-403: Booking with quantity = 10 (maximum)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is logged in; event has >= 10 available seats
**Steps**:
1. Navigate to event detail; click "+" 9 times to reach quantity 10
2. Fill form and confirm booking
**Expected Results**: Booking created with `quantity: 10`; `totalPrice = price × 10`; increment button disabled at 10
**Business Rule**: quantity boundary: 10 is maximum; UI should prevent going above 10
**Suggested Layer**: E2E

---

### TC-404: Refund eligibility boundary — quantity = 2 is NOT eligible (just above threshold)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has a booking with quantity = 2
**Steps**:
1. Navigate to booking detail
2. Click "Check eligibility for refund?"
3. Wait 4 seconds
**Expected Results**: Result shows "Not eligible for refund. Group bookings (2 tickets) are non-refundable."
**Business Rule**: Rule 8 — threshold is quantity === 1; quantity = 2 is the first ineligible value
**Suggested Layer**: E2E

---

### TC-405: Booking reference uniqueness — collision retry mechanism
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Many bookings exist with the same event title prefix (stress scenario)
**Steps**:
1. Create many bookings for events starting with the same letter
2. Verify each `bookingRef` is unique in DB
**Expected Results**: All booking references are unique; no duplicates; fallback timestamp-based ref used after 10 failed attempts
**Business Rule**: `generateUniqueRef` — up to 10 retries, then timestamp fallback
**Suggested Layer**: Unit

---

### TC-406: Clear all bookings when only one booking exists
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has exactly 1 booking
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings" and confirm
**Expected Results**: Booking is deleted; page shows empty state; `DELETE /api/bookings` returns `{ deleted: 1 }`
**Business Rule**: `clearAllBookings` — `deleteAllForUser` returns count of deleted records
**Suggested Layer**: E2E / API

---

### TC-407: Pagination on bookings list (API) — page 2 with partial results
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has more than the default page limit of bookings visible in API
**Steps**:
1. Send `GET /api/bookings?page=2&limit=5`
**Expected Results**: Returns page 2 results; `pagination.page = 2`; `data` array contains at most 5 items
**Business Rule**: Pagination behavior in `bookingService.getBookings`
**Suggested Layer**: API

---

### TC-408: Event title starting with a number — booking ref prefix is uppercase of that character
**Category**: Edge Case
**Priority**: P2
**Preconditions**: An event exists whose title starts with a digit (e.g., "100 Days Festival")
**Steps**:
1. Book the event
2. Check the `bookingRef`
**Expected Results**: `bookingRef` starts with "1-XXXXXX" (digit is used as-is, `toUpperCase()` has no effect on digits)
**Business Rule**: `randomRef` — `prefix = (eventTitle?.[0] ?? 'E').toUpperCase()`
**Suggested Layer**: API / Unit

---

### TC-409: Prune boundary — with 8 bookings the 9th is added without pruning
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has exactly 8 bookings
**Steps**:
1. Create one more booking
2. List bookings
**Expected Results**: Count is 9 and nothing was deleted. Pruning starts only when the existing count is already >= 9, so a user with 9 bookings who adds another stays at 9
**Business Rule**: `count >= MAX_USER_BOOKINGS (9)` check before the new booking is created
**Suggested Layer**: API

---

### TC-410: Booking the last available seats leaves 0 and shows "Sold Out"
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User owns a dynamic event with 4 total seats
**Steps**:
1. Book quantity 4 for that event
2. Open the event detail page and the events list
3. Send another `POST /api/bookings` for the same event with quantity 1
**Expected Results**: Booking 1 succeeds. The event shows 0 seats, the detail page shows "SOLD OUT" and the booking form button reads "Sold Out"; the card shows "SOLD OUT". Step 3: 400 "Only 0 seat(s) available, but 1 requested"
**Business Rule**: `personalAvailable < quantity` check; `EventCard` and `events/[id]/page.tsx` sold-out branches
**Suggested Layer**: E2E / API

---

### TC-411: Quantity stepper maximum is min(10, available seats)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Two events: one with 3 available seats, one with at least 25
**Steps**:
1. Open the 3-seat event and click "+" repeatedly
2. Open the larger event and click "+" repeatedly
**Expected Results**: 3-seat event: quantity stops at 3, "+" is disabled, label "(max 3)". Larger event: stops at 10, label "(max 10)"
**Business Rule**: `maxQty = Math.min(10, event.availableSeats)` in `events/[id]/page.tsx`
**Suggested Layer**: E2E / Component

---

### TC-412: Pagination boundaries with the 9-booking cap
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has exactly 9 bookings
**Steps**:
1. Send `GET /api/bookings?limit=5&page=2`
2. Send `GET /api/bookings?limit=5&page=3`
3. Send `GET /api/bookings` (default limit 10)
**Expected Results**: Step 1: 4 items, `totalPages = 2`. Step 2: empty `data`, `pagination.total = 9`. Step 3: 9 items, `totalPages = 1`. In the UI, the default page size of 10 means pagination controls never need to show for a capped user
**Business Rule**: `totalPages = ceil(total / limit)`; cap `MAX_USER_BOOKINGS = 9` vs page size 10
**Suggested Layer**: API

---

## UI State

### TC-500: Bookings list shows skeleton loading state while fetching
**Category**: UI State
**Priority**: P1
**Preconditions**: User navigates to `/bookings` (slow network or first load)
**Steps**:
1. Navigate to `/bookings` with throttled network
2. Observe the page before data loads
**Expected Results**: 5 `BookingCardSkeleton` placeholders are shown while `isLoading = true`; no real booking data yet
**Business Rule**: `isLoading` branch in `BookingsContent`
**Suggested Layer**: Component / E2E

---

### TC-501: Bookings list shows empty state when user has no bookings
**Category**: UI State
**Priority**: P1
**Preconditions**: User is logged in with zero bookings
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: Empty state renders with "No bookings yet", "You haven't booked any events yet..." description, and "Browse Events" button linking to `/events`
**Business Rule**: `bookings.length === 0` branch in `BookingsContent`
**Suggested Layer**: E2E / Component

---

### TC-502: Booking detail page shows loading spinner while fetching
**Category**: UI State
**Priority**: P2
**Preconditions**: User navigates to `/bookings/:id` on slow network
**Steps**:
1. Navigate to `/bookings/:id` with throttled network
2. Observe the page before data loads
**Expected Results**: Full-screen spinner (`Spinner size="lg"`) is visible while `isLoading = true`
**Business Rule**: `isLoading` branch in `BookingDetailPage`
**Suggested Layer**: Component

---

### TC-503: Cancel booking confirmation dialog appears before deletion
**Category**: UI State
**Priority**: P0
**Preconditions**: User is on a booking detail page
**Steps**:
1. Click "Cancel Booking" button
2. Observe dialog
**Expected Results**: `ConfirmDialog` appears with title "Cancel this booking?", description mentioning the booking ref and seat count, "Yes, cancel it" and close buttons
**Business Rule**: Two-step confirmation prevents accidental cancellations
**Suggested Layer**: E2E / Component

---

### TC-504: Cancel booking dialog close without confirming does NOT cancel
**Category**: UI State
**Priority**: P1
**Preconditions**: User is on a booking detail page
**Steps**:
1. Click "Cancel Booking"
2. Click the close/dismiss button on the dialog (not "Yes, cancel it")
3. Observe booking status
**Expected Results**: Dialog closes; booking remains in the list; no API call made
**Business Rule**: `onClose` sets `confirm = false`; `handleCancel` only runs on confirm
**Suggested Layer**: E2E

---

### TC-505: Booking detail breadcrumb displays the booking reference
**Category**: UI State
**Priority**: P2
**Preconditions**: User navigates to a valid booking detail page
**Steps**:
1. Navigate to `/bookings/:id`
2. Observe the breadcrumb nav at the top
**Expected Results**: Breadcrumb shows "My Bookings / {bookingRef}" where bookingRef is in monospace font
**Business Rule**: Breadcrumb uses `booking.bookingRef`
**Suggested Layer**: E2E

---

### TC-506: Cancel booking success — toast and redirect
**Category**: UI State
**Priority**: P0
**Preconditions**: User confirms booking cancellation
**Steps**:
1. Confirm cancellation in the dialog
2. Observe page transition and notifications
**Expected Results**: Success toast "Booking cancelled successfully" appears; user is redirected to `/bookings`
**Business Rule**: `onSuccess` callback in `handleCancel`
**Suggested Layer**: E2E

---

### TC-507: "Clear all bookings" button shows "Clearing..." while in progress
**Category**: UI State
**Priority**: P2
**Preconditions**: User has bookings; network is slow
**Steps**:
1. Click "Clear all bookings" and confirm dialog
2. Observe the button state while request is in flight
**Expected Results**: Button text changes to "Clearing…" and is disabled (`disabled:opacity-50`) during the API call
**Business Rule**: `clearing` state variable in `BookingsContent`
**Suggested Layer**: Component / E2E

---

### TC-508: Refund eligibility — "Check eligibility" button hidden after result shown
**Category**: UI State
**Priority**: P2
**Preconditions**: User is on a booking detail page in idle refund state
**Steps**:
1. Click "Check eligibility for refund?"
2. Wait for result to appear
**Expected Results**: After status transitions from "idle" → "checking" → "eligible/ineligible", the initial button is no longer visible; spinner replaces it during check; result card replaces spinner after 4 seconds
**Business Rule**: `RefundEligibility` component status state machine: idle → checking → eligible/ineligible
**Suggested Layer**: E2E / Component

---

### TC-509: Booking detail shows "Access Denied" state for 403 errors
**Category**: UI State
**Priority**: P0
**Preconditions**: Another user's booking ID is known
**Steps**:
1. Log in as User B
2. Navigate to `/bookings/:userA_booking_id`
3. Observe the rendered state
**Expected Results**: `EmptyState` with title "Access Denied" and description "You are not authorized to view this booking." renders (not "Booking not found")
**Business Rule**: Frontend checks `error.status === 403` to differentiate Access Denied vs Not Found
**Suggested Layer**: E2E

---

### TC-510: Bookings page pagination UI renders when total exceeds page size
**Category**: UI State
**Priority**: P2
**Preconditions**: API returns `pagination.totalPages > 1`
**Steps**:
1. Navigate to `/bookings` with enough bookings to trigger multi-page response
2. Observe pagination controls
**Expected Results**: `Pagination` component renders with correct `currentPage` and `totalPages`; clicking next page updates URL `?page=N` and loads next page of bookings
**Business Rule**: Pagination in `BookingsContent` driven by `pagination` from API response
**Suggested Layer**: E2E / Component

---

### TC-511: Dismissing the "Clear all bookings" confirm dialog deletes nothing
**Category**: UI State
**Priority**: P1
**Preconditions**: User has at least one booking
**Steps**:
1. Register a handler that dismisses the native dialog
2. Click "Clear all bookings"
**Expected Results**: The browser confirm shows "Clear all your bookings? This cannot be undone."; after dismissal no `DELETE /api/bookings` request is sent and the list is unchanged. Accepting it deletes everything (TC-004)
**Business Rule**: `if (!confirm(...)) return;` in `handleClearAll`
**Suggested Layer**: E2E

---

### TC-512: "Cancel Booking" is rendered only when status is "confirmed"
**Category**: UI State
**Priority**: P2
**Preconditions**: A booking whose status is not "confirmed" (not creatable through the API, since `createBooking` always sets `confirmed`; needs DB seeding or a mocked response)
**Steps**:
1. Open the detail page for a booking with `status: "cancelled"` (mock the response in Playwright)
2. Open the detail page for a normal confirmed booking
**Expected Results**: Cancelled: badge uses the danger variant with text "cancelled" and no "Cancel Booking" button. Confirmed: success badge and the button is present
**Business Rule**: `booking.status === 'confirmed' &&` guard around the Cancel button
**Suggested Layer**: Component / E2E (mocked)

---

### TC-513: Cancel failure shows an error toast and closes the dialog
**Category**: UI State
**Priority**: P2
**Preconditions**: User is on a booking detail page; the cancel request is made to fail (route-mocked 500 or the booking already deleted in another tab)
**Steps**:
1. Click "Cancel Booking" and confirm
2. Observe the page
**Expected Results**: An error toast shows the server message; the dialog closes; the user stays on `/bookings/:id` (no redirect)
**Business Rule**: `onError` in `handleCancel` calls `toast(err.message, 'error')` and `setConfirm(false)`
**Suggested Layer**: E2E (mocked)

---

### TC-514: Suspected defect — "Clear all bookings" has no error handling when the request fails
**Category**: UI State
**Priority**: P1
**Preconditions**: User has bookings; the `DELETE /api/bookings` request fails (route-mocked 500)
**Steps**:
1. Click "Clear all bookings" and accept the confirm
2. Observe the page and the console
**Expected Results**: Observed in code: `handleClearAll` has `try/finally` but no `catch`, so no error toast or message is shown, the rejection is unhandled, the button returns to "Clear all bookings" and the list is unchanged. Expected: a visible error message
**Business Rule**: `handleClearAll` in `frontend/app/bookings/page.tsx`; compare the cancel flow, which does toast on error (TC-513)
**Suggested Layer**: E2E (mocked)
