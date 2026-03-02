# Plan: Kompleksowe testy E2E, integracyjne i jednostkowe dla Omena

## Kontekst
Projekt Omena (dom aukcyjny) przeszedł wiele zmian (CMS, basePath, auth, BidPanel, DB queries). Brak jakichkolwiek testów — zero plików testowych, zero frameworków. Potrzebujemy pełnego pokrycia testami, żeby wykrywać regresje po każdej zmianie.

**Cel**: Zmapować wszystkie ścieżki użytkownika i admina, zbudować testy E2E (Playwright), integracyjne i jednostkowe (Vitest), zintegrować z CI.

---

## 1. Infrastruktura testowa

### Pakiety do zainstalowania
```
vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @playwright/test dotenv
```

### Pliki konfiguracyjne do utworzenia
| Plik | Opis |
|------|------|
| `vitest.config.ts` | Konfiguracja Vitest (jsdom dla komponentów, node dla API) |
| `playwright.config.ts` | baseURL: `http://localhost:3002/omena`, chromium + mobile |
| `.env.test` | DATABASE_URL z `omena_test`, mock Stripe keys, NEXTAUTH_SECRET |
| `tests/setup.ts` | Global setup: `@testing-library/jest-dom`, mock next/navigation |
| `tests/e2e/global-setup.ts` | Seed test DB, create test users |
| `tests/e2e/auth.setup.ts` | Login admin + user, store auth state |

### Skrypty package.json
```json
"test": "vitest run",
"test:unit": "vitest run --project unit",
"test:integration": "vitest run --project integration",
"test:coverage": "vitest run --coverage",
"test:e2e": "playwright test",
"test:all": "vitest run && playwright test"
```

### Test DB
- Osobna baza `omena_test` na tym samym PostgreSQL
- Schema via `drizzle-kit push`, seed via `db/seed.ts`
- Testy integracyjne w transakcjach z rollback

---

## 2. Struktura plików testowych

```
tests/
  setup.ts
  helpers/
    db.ts              # setupTestDb, withTransaction, cleanTable
    auth.ts            # createTestUser, createTestAdmin, getToken, mockSession
    fixtures.ts        # Factory: auction, lot, bid, invoice, consignor, apiKey
    api.ts             # HTTP helpers for route handler testing
    mocks/
      stripe.ts        # Mock paymentIntents, webhooks
      s3.ts            # Mock PutObject/DeleteObject (in-memory)
      next-auth.ts     # Mock auth() → configurable session
  unit/
    lib/               # premium, bidding, rate-limit, permissions, audit, lot-import, mappers
    validation/        # bid, auction, lot, user, admin, consignor (Zod schemas)
    components/        # BidPanel, CountdownTimer, AuctionCard, LotCard, Header, FilterBar
    i18n/              # All locales have same keys, fallback works
  integration/
    api/               # Public: auth, lots/bids, payments, SSE, v1 API
    api/admin/         # All admin CRUD endpoints
    services/          # bid-service, absentee-service, invoice-service
    middleware/        # Route protection, visibility headers
  e2e/
    .auth/             # Generated: admin.json, user.json (storageState)
    public/            # homepage, auctions, lot-detail, about, contact, events, press
    auth/              # user-login, user-registration, admin-login
    user/              # place-bid, register-for-auction, my-bids, pay-invoice
    admin/             # auction-crud, lot-crud, lot-media, users, consignors, registrations,
                       # invoices, bids, admins, analytics, audit-log, api-keys, 2fa, profile
    real-time/         # SSE bid updates (2 browser contexts)
    responsive/        # mobile navigation, mobile bid panel
```

---

## 3. Zmapowane ścieżki — testy E2E (~60 scenariuszy)

### 3.1 Strona publiczna (bez auth)
| # | Ścieżka | Plik spec | Co testujemy |
|---|---------|-----------|-------------|
| 1 | `/{locale}` | `homepage.spec.ts` | Featured auctions, nawigacja, language switcher, mobile menu |
| 2 | `/{locale}/auctions` | `auctions-listing.spec.ts` | Lista, filtry, search, pagination, linki do detali |
| 3 | `/{locale}/auctions/{slug}` | `auction-detail.spec.ts` | Tytuł, daty, lot grid, countdown |
| 4 | `/{locale}/auctions/{slug}/{lotId}` | `lot-detail.spec.ts` | Galeria, info, bid panel, breadcrumbs |
| 5 | `/{locale}/about` | `about.spec.ts` | Team, values, rendering |
| 6 | `/{locale}/contact` | `contact.spec.ts` | Formularz kontaktowy |
| 7 | `/{locale}/events` | `events.spec.ts` | Event cards |
| 8 | `/{locale}/press` | `press.spec.ts` | Press items |

### 3.2 Auth flows
| # | Ścieżka | Plik spec | Co testujemy |
|---|---------|-----------|-------------|
| 9 | `/{locale}/login` | `user-login.spec.ts` | Login valid/invalid, redirect po login |
| 10 | POST `/api/auth/register` | `user-registration.spec.ts` | Rejestracja, duplikat email |
| 11 | `/admin/login` | `admin-login.spec.ts` | Admin login, redirect do dashboard |

### 3.3 Zalogowany użytkownik
| # | Ścieżka | Plik spec | Co testujemy |
|---|---------|-----------|-------------|
| 12 | Bid on lot | `place-bid.spec.ts` | Input, confirm modal, sukces, historia, min bid error |
| 13 | Register for auction | `register-for-auction.spec.ts` | Modal, submit, confirmation |
| 14 | `/{locale}/my-bids` | `my-bids.spec.ts` | Lista ofert, winning/outbid status |
| 15 | `/{locale}/pay/{id}` | `pay-invoice.spec.ts` | Stripe form, invoice details |

### 3.4 Panel admina (pełne CRUD)
| # | Obszar | Plik spec | Scenariusze |
|---|--------|-----------|-------------|
| 16 | Aukcje | `auction-crud.spec.ts` | Create, edit, delete, list |
| 17 | Status aukcji | `auction-status.spec.ts` | Draft→Preview→Live→Reconciliation→Archive |
| 18 | Loty | `lot-crud.spec.ts` | Create, edit, delete, status change |
| 19 | Import CSV | `lot-import-csv.spec.ts` | Upload, preview, confirm, errors |
| 20 | Media | `lot-media.spec.ts` | Upload, reorder, set primary, delete, YouTube |
| 21 | Tłumaczenia | `lot-translations.spec.ts` | Edit EN, save, verify |
| 22 | Użytkownicy | `user-management.spec.ts` | CRUD + visibility + search |
| 23 | Komitenci | `consignor-management.spec.ts` | CRUD + search |
| 24 | Rejestracje | `registration-management.spec.ts` | Approve (paddle#), reject, bulk |
| 25 | Faktury | `invoice-management.spec.ts` | Generate, filter, status change, view HTML |
| 26 | Oferty | `bid-management.spec.ts` | View, retract |
| 27 | Admini | `admin-management.spec.ts` | Create, edit role, delete |
| 28 | Analityka | `analytics-dashboard.spec.ts` | 6 tabów, dane |
| 29 | Audit log | `audit-log.spec.ts` | Filtry, pagination, diff view |
| 30 | API keys | `api-keys.spec.ts` | Create, list, deactivate, delete |
| 31 | 2FA | `security-2fa.spec.ts` | Setup, QR, enable, disable |
| 32 | Profil | `profile.spec.ts` | Edit name, change password |

### 3.5 Real-time & responsive
| # | Plik spec | Co testujemy |
|---|-----------|-------------|
| 33 | `sse-bid-updates.spec.ts` | 2 konteksty: bid A → update u B via SSE |
| 34 | `mobile-navigation.spec.ts` | Hamburger, linki, language switcher (375px) |
| 35 | `mobile-bid-panel.spec.ts` | Bid panel usable on mobile |

---

## 4. Testy integracyjne (~120 scenariuszy)

Testują API route handlers z prawdziwą bazą danych (w transakcjach), mock Stripe/S3.

| Grupa | Plik | Kluczowe scenariusze |
|-------|------|---------------------|
| Auth | `register.integration.test.ts` | Create user, duplicate 409, password hashed |
| Auth | `login.integration.test.ts` | Valid/invalid login, inactive user blocked |
| Bids | `bids.integration.test.ts` | 401/403/429, min bid, self-outbid 409, success |
| Absentee | `absentee.integration.test.ts` | Create/update/cancel, auto-counter |
| Payments | `create-intent.integration.test.ts` | Stripe mock, paid invoice 400 |
| Payments | `webhook.integration.test.ts` | succeeded/failed events, signature check |
| SSE | `auction-stream.integration.test.ts` | Connect, receive bid event, heartbeat |
| API v1 | `auctions.integration.test.ts` | API key auth, pagination, filters |
| API v1 | `lots.integration.test.ts` | Detail, search, by slug |
| Admin Auctions | `auctions.integration.test.ts` | CRUD + status transitions + reorder |
| Admin Lots | `lots.integration.test.ts` | CRUD + status + reorder |
| Admin Import | `lots-import.integration.test.ts` | CSV parse + bulk insert |
| Admin Users | `users.integration.test.ts` | CRUD + search/filter |
| Admin Consignors | `consignors.integration.test.ts` | CRUD |
| Admin Registrations | `registrations.integration.test.ts` | Approve/reject/bulk |
| Admin Invoices | `invoices.integration.test.ts` | Generate, status transitions |
| Admin Bids | `bids.integration.test.ts` | View, retract |
| Admin Media | `media.integration.test.ts` | Upload (mock S3), delete, reorder, primary |
| Admin API Keys | `api-keys.integration.test.ts` | CRUD + hashing |
| Admin 2FA | `two-factor.integration.test.ts` | Setup/enable/disable/verify |
| Analytics | `analytics.integration.test.ts` | 6 report types |
| Audit | `audit-log.integration.test.ts` | Filter, pagination |
| Services | `bid-service.integration.test.ts` | placeBid z pełnym DB setup, advisory lock |
| Services | `invoice-service.integration.test.ts` | Generate z premium tiers, status transitions |
| Middleware | `middleware.integration.test.ts` | Admin redirect, API 401, headers |

---

## 5. Testy jednostkowe (~80 scenariuszy)

Czysta logika biznesowa, bez DB, z mockami.

| Grupa | Plik | Co testujemy |
|-------|------|-------------|
| Premium | `premium.unit.test.ts` | `calculatePremium` z tierami, `calculateFlatPremium`, edge cases |
| Bidding | `bidding.unit.test.ts` | `getBidIncrement` (11 progów), `getNextMinBid` |
| Rate limit | `rate-limit.unit.test.ts` | Token bucket, refill, cleanup |
| Permissions | `permissions.unit.test.ts` | 5 ról × permission matrix |
| Audit | `audit.unit.test.ts` | `computeChangedFields` |
| Lot import | `lot-import.unit.test.ts` | CSV parsing, validation, BOM, errors |
| Invoice | `invoice-service.unit.test.ts` | Status transition matrix |
| Mappers | `mappers.unit.test.ts` | DB→frontend mapping |
| Validation | `bid.unit.test.ts` | Zod: valid/invalid bid schemas |
| Validation | `auction.unit.test.ts` | Zod: required fields, slug format |
| Validation | `lot.unit.test.ts` | Zod: lotNumber, estimates |
| Validation | `user.unit.test.ts` | Zod: email, password min 8 |
| Validation | `admin.unit.test.ts` | Zod: role defaults |
| Validation | `consignor.unit.test.ts` | Zod: commissionRate |
| Components | `CountdownTimer.unit.test.tsx` | Future/past date, live update |
| Components | `BidHistory.unit.test.tsx` | Render bids, retracted indicator |
| Components | `FilterBar.unit.test.tsx` | onChange callback |
| i18n | `translations.unit.test.ts` | All locales same keys, fallback |

---

## 6. CI Pipeline (`.forgejo/workflows/ci.yml`)

```
lint ──────────────┐
unit-tests ────────┤
integration-tests ─┼──> ci-gate ──> push-to-external
build ─────────────┤
e2e-tests (after build) ┘
```

- `lint`, `unit-tests`, `integration-tests`, `build` — równolegle
- `e2e-tests` — po `build` (potrzebuje dev server)
- `ci-gate` — czeka na wszystko
- Service containers: `postgres:16-alpine` + `minio/minio`
- Playwright: `npx playwright install --with-deps chromium`

---

## 7. Agent Team (`omena-testing`)

| Agent | Model | Zadania | Zależy od |
|-------|-------|---------|-----------|
| **test-infra** | sonnet | Packages, configs, helpers, mocks, .env.test, scripts | — |
| **test-unit** | sonnet | Wszystkie testy jednostkowe (15-17 plików) | test-infra |
| **test-integration** | sonnet | Wszystkie testy integracyjne (20-22 plików) | test-infra |
| **test-e2e** | sonnet | Playwright setup + wszystkie spec (25-28 plików) | test-infra |
| **test-ci** | haiku | Update ci.yml z test jobs | test-infra (script names) |
| **test-verify** | sonnet | Uruchomienie wszystkich testów, fix do skutku | all above |

### Kolejność
1. **Faza 1**: test-infra (sam) — instalacja, konfiguracja, helpery
2. **Faza 2**: test-unit + test-integration + test-e2e + test-ci (równolegle)
3. **Faza 3**: test-verify — `npm run test:all`, naprawianie błędów w pętli

---

## 8. Kluczowe pliki projektu

| Plik | Rola w testach |
|------|---------------|
| `lib/premium.ts` | Pure logic — unit tests |
| `app/lib/bidding.ts` | Pure logic — unit tests |
| `lib/bid-service.ts` | Core service — integration tests (advisory lock, SSE emit) |
| `lib/permissions.ts` | Role matrix — unit tests |
| `lib/validation/*.ts` | Zod schemas — unit tests |
| `lib/auth.ts` | NextAuth config — mock for all layers |
| `db/connection.ts` | Pool setup — test DB helper |
| `db/seed.ts` | Test data — E2E global setup |
| `middleware.ts` | Route protection — integration tests |
| `app/api/lots/[id]/bids/route.ts` | Bidding API — integration + E2E |
| `app/api/admin/**` | Admin CRUD — integration + E2E |
| `.forgejo/workflows/ci.yml` | CI pipeline — add test jobs |

---

## 9. Test Helpers — szczegóły

### `tests/helpers/db.ts`
- `setupTestDb()` — weryfikacja połączenia z omena_test, migracje
- `teardownTestDb()` — zamknięcie puli
- `withTransaction(fn)` — BEGIN/ROLLBACK wrapper per test
- `cleanTable(tableName)` — truncate między testami
- `seedTestData()` — programmatyczne uruchomienie seeda

### `tests/helpers/auth.ts`
- `createTestUser(overrides?)` — insert do DB, zwraca user + plain password
- `createTestAdmin(role, overrides?)` — insert admin
- `getAdminToken(email, password)` — JWT via admin-credentials provider
- `getUserToken(email, password)` — JWT via user-credentials provider
- `mockAdminSession(role)` — mock session object (unit tests)
- `mockUserSession(visibilityLevel)` — mock session object

### `tests/helpers/fixtures.ts`
Factory functions:
- `createAuctionFixture(overrides?)` — valid auction DB insert
- `createLotFixture(auctionId, overrides?)` — valid lot
- `createBidFixture(lotId, userId, registrationId, overrides?)` — bid
- `createInvoiceFixture(userId, auctionId, lotId, overrides?)` — invoice
- `createConsignorFixture(overrides?)` — consignor
- `createApiKeyFixture()` — API key pair (plain + hashed)

### `tests/helpers/mocks/`
- **`stripe.ts`**: Mock `paymentIntents.create/retrieve`, `webhooks.constructEvent`
- **`s3.ts`**: In-memory Map for `PutObject/DeleteObject`, mock `getSignedUrl`
- **`next-auth.ts`**: Mock `auth()` returning configurable session

---

## 10. Weryfikacja końcowa

1. `npm run test:unit` — zero failures
2. `npm run test:integration` — zero failures (z test DB)
3. `npm run test:e2e` — zero failures (z dev server)
4. `npm run test:coverage` — raport pokrycia
5. CI pipeline na Forgejo — pełny green
6. Sprawdzić regresje: login admin, bidding, admin CRUD
