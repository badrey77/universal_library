# Universal Library

A book-lending library app: catalog browsing, holds, and circulation
(checkout/return/renew), with a UI available in English, French, and
Arabic (with right-to-left layout).

## Architecture

- `server/` — Express + TypeScript API, Prisma ORM over SQLite.
  - **Catalog**: `Book` (metadata) vs. `Copy` (a physical/lendable unit with
    its own barcode and status) — you lend copies, not books.
  - **Circulation**: `Loan` and `Hold` state machines. Checkout/return run
    inside DB transactions with an optimistic status check on the copy row,
    so two staff desks can never check out the same copy twice. Returning a
    copy automatically fulfills the oldest waiting hold on that book instead
    of releasing it back to general availability.
  - **Auth**: JWT-based, two roles — `PATRON` and `STAFF`. Checkout/return
    are staff-only; patrons self-serve holds and renewals on their own loans.
- `web/` — React + Vite SPA. `react-i18next` drives translations; the
  Arabic locale flips `<html dir="rtl">` automatically. Layout uses CSS
  logical properties (`margin-inline`, etc.) so it doesn't need separate
  RTL stylesheets.

## Running locally

### Backend

```bash
cd server
cp .env.example .env
npm install
npm run prisma:migrate   # creates dev.db and applies migrations
npm run seed              # demo data: staff + patron accounts, 4 books
npm run dev                # http://localhost:4000
```

Seeded accounts:
- Staff: `staff@library.test` / `staff123`
- Patron: `patron@library.test` / `patron123`

### Frontend

```bash
cd web
npm install
npm run dev   # http://localhost:5173, proxies /api to :4000
```

Open http://localhost:5173, switch languages with the EN/FR/AR buttons in
the header. Log in as staff to reach the Staff Desk (checkout/return by
barcode), or as a patron to browse the catalog, place holds, and view/renew
loans.

## API overview

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/auth/register` / `login` | — | Patron sign-up / login |
| `GET /api/books?q=` | — | Search catalog |
| `GET /api/books/:id` | — | Book detail + copy statuses |
| `POST /api/books` | staff | Add a book (+ initial copies) |
| `POST /api/circulation/checkout` | staff | `{ barcode, memberId }` |
| `POST /api/circulation/return` | staff | `{ barcode }` |
| `POST /api/circulation/renew` | owner or staff | `{ loanId }` |
| `POST /api/holds` | patron | `{ bookId }` |
| `DELETE /api/holds/:id` | owner or staff | Cancel a hold |
| `GET /api/members/me/loans` / `me/holds` | auth | Self-service views |

## Notes / next steps

This is a working MVP scoped for a single branch. Not yet implemented:
overdue fine accrual (would be a scheduled job over `loans`), hold
expiry sweeping, and multi-branch transfers — all called out as open
design questions in the original architecture discussion.
