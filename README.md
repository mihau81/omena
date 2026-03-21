# Omenaa -- Dom Aukcyjny Dziel Sztuki

Platforma aukcyjna dla domu aukcyjnego Omenaa, obslugujaca aukcje online dziel sztuki w czasie rzeczywistym. System obejmuje katalogowanie dziel, licytacje z SSE (Server-Sent Events), platnosci Stripe, generowanie faktur PDF, panel administracyjny z systemem rol oraz wielojezyczny interfejs publiczny (5 jezykow).

Aplikacja dziala pod sciezka `/omenaa` (basePath) i serwuje zarowno strone publiczna dla licytujacych, jak i panel CMS dla zespolu domu aukcyjnego.

---

## Tech Stack

| Technologia | Wersja | Opis |
|---|---|---|
| Next.js | 16.1.6 | Framework React (App Router, standalone output) |
| React | 19.2.3 | Biblioteka UI |
| TypeScript | 5.x | Typowanie statyczne |
| PostgreSQL | 16 (Alpine) | Glowna baza danych |
| Drizzle ORM | 0.45.1 | ORM z pelnym typowaniem |
| Redis | 7 (Alpine) | Pub/sub dla SSE, cache |
| MinIO | latest | Storage S3-kompatybilny (obrazy) |
| NextAuth | 5.0 beta | Uwierzytelnianie (JWT, Credentials) |
| Stripe | 20.4.0 | Platnosci online |
| Tailwind CSS | 4.x | Stylowanie |
| Vitest | 4.0.18 | Testy unit + integration |
| Playwright | 1.58.2 | Testy E2E |
| Sentry | 10.41.0 | Monitoring bledow (opcjonalny) |
| BullMQ | 5.70.1 | Kolejka zadan (email, PDF) |
| PDFKit | 0.17.2 | Generowanie faktur i katalogow PDF |
| Sharp | 0.34.5 | Przetwarzanie obrazow |
| Zod | 4.3.6 | Walidacja danych |
| Docker | - | Konteneryzacja (multi-stage build) |
| Node.js | 20 (Alpine) | Runtime |

---

## Szybki start

### Wymagania

- Node.js 20+
- Docker i Docker Compose
- npm

### Krok po kroku

```bash
# 1. Sklonuj repozytorium
git clone http://192.168.5.30:3000/mihau81/omena.git
cd omena

# 2. Skopiuj plik srodowiskowy
cp .env.example .env.local

# 3. Uruchom serwisy (PostgreSQL, MinIO, Redis)
docker compose up -d db minio redis

# 4. Zainstaluj zaleznosci
npm ci

# 5. Utworz tabele w bazie danych
npx drizzle-kit push

# 6. Zaladuj dane testowe
npx tsx db/seed.ts

# 7. Uruchom serwer deweloperski
npm run dev
```

Aplikacja dostepna pod: **http://localhost:3002/omenaa**

### Dane logowania (dev)

| Rola | Email | Haslo |
|---|---|---|
| Admin (super_admin) | michal@bialek.pl | admin1234 |

### Dodatkowe serwisy

| Serwis | URL | Dane dostepu |
|---|---|---|
| MinIO Console | http://localhost:9001 | omenaa / omenaa_dev |
| PostgreSQL | localhost:5432 | omenaa / omenaa_dev |

---

## Struktura projektu

```
omena/
├── app/
│   ├── [locale]/              # Strony publiczne (pl, en, de, fr, es)
│   │   ├── about/             # O nas
│   │   ├── account/           # Konto uzytkownika
│   │   ├── admin/             # Panel administracyjny
│   │   ├── artists/           # Lista artystow
│   │   ├── auctions/          # Lista aukcji i strony aukcji
│   │   ├── auth/              # Weryfikacja email, reset hasla
│   │   ├── contact/           # Kontakt
│   │   ├── events/            # Wydarzenia
│   │   ├── login/             # Logowanie
│   │   ├── my-bids/           # Moje licytacje (zalogowany user)
│   │   ├── pay/               # Platnosci Stripe
│   │   ├── press/             # Prasa
│   │   ├── register/          # Rejestracja
│   │   └── results/           # Wyniki aukcji
│   ├── api/
│   │   ├── admin/             # API panelu admina (CRUD zasobow)
│   │   ├── auctions/          # Publiczne dane aukcji
│   │   ├── auth/              # NextAuth endpoints
│   │   ├── currency/          # Kursy walut (NBP)
│   │   ├── health/            # Health check
│   │   ├── internal/          # Endpointy wewnetrzne
│   │   ├── lots/              # Publiczne dane lotow
│   │   ├── me/                # API zalogowanego uzytkownika
│   │   ├── payments/          # Webhook Stripe
│   │   ├── sse/               # Server-Sent Events (licytacja live)
│   │   ├── user/              # Rejestracja, logowanie
│   │   └── v1/               # Publiczne API v1 (agregatory)
│   ├── components/            # Wspoldzielone komponenty React
│   └── lib/                   # Logika biznesowa strony klienta
│       ├── i18n/              # Tlumaczenia (pl, en, de, fr, es)
│       └── bidding.ts         # Logika licytacji (kroki, walidacja)
├── lib/                       # Logika serwera
│   ├── auth.ts                # Konfiguracja NextAuth
│   ├── bid-service.ts         # Serwis licytacji
│   ├── absentee-service.ts    # Zlecenia stale (proxy bids)
│   ├── bid-events.ts          # SSE + Redis pub/sub
│   ├── lot-timer.ts           # Timer anti-sniping
│   ├── permissions.ts         # RBAC (role-based access control)
│   ├── audit.ts               # Logowanie zmian (audit trail)
│   ├── invoice-pdf.ts         # Generowanie faktur PDF
│   ├── catalog-pdf.ts         # Generowanie katalogow PDF
│   ├── image-pipeline.ts      # Przetwarzanie i resize obrazow
│   ├── payment-service.ts     # Integracja Stripe
│   ├── email.ts               # Wysylka emaili (SMTP)
│   ├── push.ts                # Web Push notifications
│   ├── ai.ts                  # Generowanie opisow AI (Anthropic)
│   └── rate-limit.ts          # Rate limiting
├── db/
│   ├── schema.ts              # Schemat bazy danych (Drizzle ORM)
│   ├── relations.ts           # Relacje miedzy tabelami
│   ├── connection.ts          # Polaczenie z baza
│   ├── queries/               # Reuzywalne zapytania
│   ├── migrations/            # Migracje SQL
│   ├── seed.ts                # Dane testowe
│   ├── seed-artists.ts        # Artyści testowi
│   └── seed-settings.ts       # Ustawienia domyslne
├── tests/
│   ├── unit/                  # Testy jednostkowe (jsdom)
│   ├── integration/           # Testy integracyjne (node, PostgreSQL)
│   ├── e2e/                   # Testy E2E (Playwright, Chromium)
│   └── helpers/               # Helpery testowe
├── middleware.ts               # Edge middleware (auth, security headers, CSP)
├── docker-compose.yml          # Serwisy dev (DB, MinIO, Redis)
├── docker-compose.prod.yml     # Konfiguracja produkcyjna
├── Dockerfile                  # Multi-stage build (standalone)
└── next.config.ts              # Konfiguracja Next.js (basePath: /omenaa)
```

---

## Architektura

### Diagram systemu

```
                                 ┌─────────────────────────────────────┐
                                 │           Nginx (port 80)           │
                                 │     reverse proxy: /omenaa/ ->      │
                                 └──────────────┬──────────────────────┘
                                                │
                                 ┌──────────────▼──────────────────────┐
                                 │     Next.js App (port 3080/3000)    │
                                 │                                     │
                                 │  ┌─────────┐  ┌──────────────────┐  │
                                 │  │  Pages   │  │  API Routes      │  │
                                 │  │ (SSR/SC) │  │  (REST + SSE)    │  │
                                 │  └─────────┘  └──────────────────┘  │
                                 │                                     │
                                 │  ┌─────────────────────────────────┐│
                                 │  │     Edge Middleware             ││
                                 │  │  (JWT decode, ACL, CSP headers) ││
                                 │  └─────────────────────────────────┘│
                                 └──┬──────────┬───────────┬───────────┘
                                    │          │           │
                         ┌──────────▼┐   ┌─────▼────┐  ┌──▼──────────┐
                         │PostgreSQL │   │  MinIO   │  │   Redis     │
                         │  (5432)   │   │  (9000)  │  │   (6379)    │
                         │           │   │  S3 API  │  │  pub/sub    │
                         │ 22 tabel  │   │  obrazy  │  │  SSE bids   │
                         └───────────┘   └──────────┘  └─────────────┘
```

### Uwierzytelnianie (Auth)

System obsluguje dwa typy uzytkownikow przez wspolny formularz logowania:

- **Users** (klienci aukcji) -- tabela `users`, rejestracja z zatwierdzeniem, logowanie po statusie `approved`
- **Admins** (zespol domu aukcyjnego) -- tabela `admins`, opcjonalne TOTP 2FA, krotsze okno re-walidacji

Sesje oparte na JWT (bez session store w bazie). Token zawiera `userType`, `visibilityLevel`, `role` i `lastValidated`. Middleware dekoduje JWT na Edge bez round-tripu do bazy i propaguje naglowki `x-user-id`, `x-user-type`, `x-user-visibility` do route handlerow.

Okresowa re-walidacja tokenu wykrywa odwolanie konta bez koniecznosci uzycia krotkotrwalych tokenow.

### System licytacji (Bidding)

```
Przegladarka            Serwer                        Baza danych
    │                      │                              │
    ├── POST /api/bid ────>│                              │
    │                      ├── pg_advisory_xact_lock ────>│
    │                      ├── walidacja kwoty            │
    │                      ├── INSERT bid ───────────────>│
    │                      ├── anti-sniping check         │
    │                      ├── extend timer (jesli <30s)  │
    │                      ├── Redis PUBLISH ─────> Redis │
    │                      │                              │
    │<── SSE event ────────┤<── Redis SUBSCRIBE           │
    │                      │                              │
    │                      ├── processAbsenteeBids()      │
    │                      │   (asynchronicznie)          │
```

Kluczowe mechanizmy:

- **Advisory locks** -- `pg_advisory_xact_lock` na `lotId` zapobiega duplikatom zwycieskich ofert przy rownoczesnych requestach
- **Anti-sniping** -- oferta w ostatnich 30 sekundach przedluza timer o kolejne 30 sekund
- **Zlecenia stale (Absentee bids)** -- system automatycznie licytuje w imieniu uzytkownikow do ich maksymalnej kwoty
- **SSE (Server-Sent Events)** -- aktualizacje licytacji w czasie rzeczywistym przez Redis pub/sub
- **Append-only** -- oferty nie sa usuwane; cofniecie oferty to oddzielny rekord w `bid_retractions`
- **Typy ofert** -- online, telefonicznie, sala (floor), zlecenie stale, systemowe (auto-bid)

### Cykl zycia lotu (Lot lifecycle)

```
draft --> catalogued --> published --> active --> sold
                                             └-> passed
                                             └-> withdrawn
```

### Cykl zycia aukcji (Auction lifecycle)

```
draft --> preview --> live --> reconciliation --> archive
```

### Widocznosc (Visibility)

Trzy poziomy: **Public (0)**, **Private (1)**, **VIP (2)**. Lot dziedziczy poziom widocznosci od aukcji, chyba ze ma ustawiony `visibilityOverride`.

---

## Baza danych

Schemat w Drizzle ORM -- single source of truth w pliku `db/schema.ts`.

### Glowne tabele

| Tabela | Opis |
|---|---|
| `auctions` | Aukcje (status, widocznosc, buyer's premium, livestream URL) |
| `lots` | Obiekty/dziela (estymacja, cena rezerwowa, timer, full-text search) |
| `artists` | Artysci (slug, bio, lata zycia) |
| `consignors` | Komitenci/wlasciciele dziel (prowizja, dane kontaktowe) |
| `media` | Obrazy i wideo YouTube (warianty: thumbnail/medium/large) |
| `users` | Klienci aukcji (status konta, weryfikacja email, level widocznosci) |
| `admins` | Administratorzy (role, TOTP 2FA) |
| `bids` | Oferty -- append-only, immutable (online/phone/floor/absentee/system) |
| `bid_retractions` | Cofniecia ofert (powod, kto cofnal) |
| `absentee_bids` | Zlecenia stale (maksymalna kwota) |
| `bid_registrations` | Rejestracje do licytacji (numer rakietki/paddle) |
| `invoices` | Faktury (cena mlotka + buyer's premium) |
| `payments` | Platnosci Stripe (status, external ID) |
| `settlements` | Rozliczenia z komitentami |
| `settlement_items` | Pozycje rozliczen (lot, prowizja) |
| `premium_tiers` | Progi buyer's premium (sliding scale) |
| `audit_log` | Dziennik zmian (before/after JSONB, IP, kto) |
| `notifications` | Powiadomienia uzytkownikow (outbid, won, etc.) |
| `push_subscriptions` | Subskrypcje Web Push |
| `lot_translations` | Tlumaczenia opisow lotow (Phase 2) |
| `settings` | Ustawienia systemowe (key-value) |
| `user_logins` | Historia logowan (IP, geolokalizacja) |
| `page_views` | Sledzenie nawigacji |
| `api_keys` | Klucze API (agregatory: Invaluable, Artnet) |
| `qr_registrations` | Kody QR do rejestracji na wydarzeniach |
| `user_whitelists` | Whitelista emaili (auto-approval) |
| `user_invitations` | Zaproszenia uzytkownikow |
| `verification_tokens` | Tokeny weryfikacji email / magic link / reset hasla |
| `sessions` | Sesje (dla Auth.js) |
| `watched_lots` | Obserwowane loty |

Soft delete: glowne encje maja kolumne `deletedAt`. Zapytania musza filtrowac `isNull(deletedAt)`. Hard delete nie jest uzywany.

Pelny schemat: `db/schema.ts`

---

## API

### Strony publiczne (`/[locale]/...`)

| Sciezka | Opis |
|---|---|
| `/auctions` | Lista aukcji |
| `/auctions/[slug]` | Strona aukcji z lotami |
| `/artists` | Lista artystow |
| `/artists/[slug]` | Profil artysty |
| `/results` | Wyniki zakonczonych aukcji |
| `/events` | Wydarzenia |
| `/press` | Prasa |
| `/about` | O nas |
| `/contact` | Kontakt |
| `/login` | Logowanie |
| `/register` | Rejestracja |

### API uzytkownika (`/api/me/...`)

| Endpoint | Opis |
|---|---|
| `GET /api/me/profile` | Profil uzytkownika |
| `PUT /api/me/password` | Zmiana hasla |
| `GET /api/me/notifications` | Lista powiadomien |
| `GET /api/me/invoices` | Faktury uzytkownika |
| `GET /api/me/favorites` | Obserwowane loty |
| `POST /api/me/push-subscription` | Subskrypcja Web Push |
| `GET /api/me/registrations` | Rejestracje do aukcji |
| `GET /api/me/referral` | Program polecen |

### API administratora (`/api/admin/...`)

Endpointy CRUD dla wszystkich zasobow: aukcje, loty, media, artysci, komitenci, uzytkownicy, admini, faktury, rozliczenia, klucze API, rejestracje QR, raporty, analityka, audit log, ustawienia, 2FA.

Dostep kontrolowany przez middleware -- wymagana rola admina z odpowiednimi uprawnieniami.

### Publiczne API v1 (`/api/v1/...`)

API dla agregatorow (Invaluable, Artnet, Barnebys):

| Endpoint | Opis |
|---|---|
| `GET /api/v1/auctions` | Lista aukcji (publiczne) |
| `GET /api/v1/lots` | Lista lotow z filtrami |
| `GET /api/v1/docs` | Dokumentacja API (OpenAPI) |

Uwierzytelnianie: API key w naglowku `X-API-Key`. Rate limit konfigurowalny per klucz.

### SSE -- licytacja na zywo

```
GET /api/sse/auction/[id]
```

Stream eventow licytacji w czasie rzeczywistym. Uzywa Redis pub/sub do synchronizacji miedzy instancjami. Fallback na in-memory EventEmitter dla single-instance.

---

## Panel administracyjny

Dostepny pod `/[locale]/admin/`. Wymaga zalogowania jako admin.

### Funkcje panelu

- **Aukcje** -- tworzenie, edycja, zmiana statusow, generowanie katalogu PDF, livestream URL
- **Loty** -- CRUD, drag-and-drop sortowanie, import CSV, upload obrazow, warianty (thumbnail/medium/large)
- **Artysci** -- zarzadzanie baza artystow
- **Komitenci** -- dane wlascicieli dziel, stawki prowizji
- **Licytacje** -- podglad live, wprowadzanie ofert (sala/telefon), cofanie ofert
- **Uzytkownicy** -- zatwierdzanie rejestracji, zmiana statusu konta, widocznosc
- **Faktury** -- generowanie, wysylka, status platnosci
- **Rozliczenia** -- rozliczenia z komitentami per aukcja
- **Raporty** -- statystyki sprzedazy, analityka
- **Audit log** -- pelna historia zmian z before/after
- **Klucze API** -- tworzenie i zarzadzanie kluczami dla agregatorow
- **Rejestracje QR** -- kody QR dla wydarzen (auto-rejestracja)
- **Whitelista** -- import emaili z automatycznym zatwierdzeniem
- **Ustawienia** -- konfiguracja systemu (key-value)
- **Bezpieczenstwo** -- zarzadzanie 2FA (TOTP)

### Hierarchia rol

| Rola | Uprawnienia |
|---|---|
| `super_admin` | Pelny dostep, zarzadzanie innymi adminami |
| `admin` | Pelny CMS, nie moze zarzadzac super_adminami |
| `cataloguer` | Aukcje (read), loty (CRUD), media (upload) |
| `auctioneer` | Aukcje (read/status), licytacje, rejestracje |
| `viewer` | Tylko odczyt (audytorzy, stazysci) |

---

## i18n

Aplikacja obsluguje 5 lokalizacji:

| Kod | Jezyk |
|---|---|
| `pl` | Polski (domyslny) |
| `en` | Angielski |
| `de` | Niemiecki |
| `fr` | Francuski |
| `es` | Hiszpanski |

Tlumaczenia interfejsu w plikach `app/lib/i18n/{locale}.ts`. Kazdy plik eksportuje slownik `Record<DictionaryKey, string>`.

Routing: `/{locale}/auctions`, `/{locale}/artists`, itd. Middleware wykrywa locale z URL i przekazuje do layoutu.

**Phase 2** -- tlumaczenia tresci bazy danych (opisy lotow, proweniencja) w tabeli `lot_translations`, per locale.

---

## Testy

### Uruchamianie testow

```bash
# Testy jednostkowe (jsdom, nie wymaga bazy)
npm run test:unit

# Testy integracyjne (wymaga PostgreSQL -- docker compose up -d db)
npm run test:integration

# Testy E2E (wymaga dzialajacego serwera)
npm run test:e2e

# Wszystkie testy Vitest (unit + integration)
npm run test

# Wszystkie testy (Vitest + Playwright)
npm run test:all

# Raport pokrycia kodu
npm run test:coverage
```

### Statystyki

- **2846** testow
- **95%** pokrycie linii kodu
- Unit: `tests/unit/` -- logika biznesowa, walidacja, API route handlery, komponenty, middleware
- Integration: `tests/integration/` -- zapytania do bazy, API z prawdziwa baza, middleware, serwisy
- E2E: `tests/e2e/` -- smoke testy, panel admina, auth flow, strony publiczne, licytacja real-time, responsywnosc

### Struktura testow

```
tests/
├── unit/
│   ├── api/           # Testy route handlerow API
│   ├── components/    # Testy komponentow React
│   ├── db/            # Testy schematu i helperow
│   ├── i18n/          # Testy tlumaczen
│   ├── lib/           # Testy logiki biznesowej
│   └── validation/    # Testy walidacji Zod
├── integration/
│   ├── api/           # Testy API z prawdziwa baza
│   ├── db/            # Testy zapytan SQL
│   ├── middleware/     # Testy middleware
│   ├── queries/       # Testy reuzywlanych zapytan
│   └── services/      # Testy serwisow
├── e2e/
│   ├── admin/         # Panel administracyjny
│   ├── auth/          # Logowanie, rejestracja
│   ├── public/        # Strony publiczne
│   ├── real-time/     # Licytacja live (SSE)
│   ├── responsive/    # Responsywnosc
│   ├── user/          # Panel uzytkownika
│   └── smoke.spec.ts  # Smoke testy (CI)
├── helpers/           # Fabryki, mocki, helpery
├── setup.ts           # Setup dla unit testow
└── setup.integration.ts # Setup dla integracyjnych
```

---

## CI/CD Pipeline

### Przeplyw

```
Developer -> git push -> Forgejo (CI) -> GitHub (mirror) -> Hetzner (deploy)
```

### Forgejo CI (`.forgejo/workflows/ci.yml`)

Pipeline uruchamia sie na `push` i `pull_request` do `main`:

| Job | Opis |
|---|---|
| `checks` | Lint (ESLint) + testy jednostkowe |
| `integration-tests` | Testy integracyjne (z serwisem PostgreSQL) |
| `build` | Build standalone (weryfikacja outputu) |
| `e2e-tests` | Smoke testy Playwright (z uruchomionym serwerem) |
| `ci-gate` | Brama -- wymaga przejscia wszystkich powyzszych |
| `push-to-external` | Mirror na GitHub (tylko push, nie PR) |

### GitHub Actions (`.github/workflows/deploy.yml`)

Deploy uruchamia sie na `push` do `main` na GitHub:

1. Tworzy archiwum tar.gz (bez node_modules, .git, .next)
2. SCP na serwer Hetzner
3. Ekstraktuje, buduje Docker image, uruchamia
4. Health check (15 prob, timeout 75s)

---

## Deployment

### Produkcja (Hetzner)

- **URL**: http://bialek.pl/omenaa/
- **Serwer**: 77.42.31.51
- **Katalog**: `/root/omenaa`
- **Docker**: `docker-compose.prod.yml`
  - `omenaa_app` -- Next.js (port 3080 -> 3000)
  - `omenaa_db` -- PostgreSQL 16
  - `omenaa_minio` -- MinIO (port 9002 -> 9000)
  - `omenaa_redis` -- Redis 7

Nginx systemowy (port 80) proxy: `/omenaa/` -> `localhost:3080`.

### Build produkcyjny

Multi-stage Dockerfile:
1. **builder** -- `npm ci` + `npm run build` (standalone output)
2. **runner** -- kopiuje standalone + static + public + zaleznosci runtime (pdfkit, fontkit, etc.)

Obraz wynikowy zawiera tylko serwer Node.js (`server.js`) i niezbedne pliki.

### Reczny deploy

```bash
# Na serwerze Hetzner
cd /root/omenaa
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
```

---

## Zmienne srodowiskowe

Plik `.env.example` zawiera wszystkie zmienne. Skopiuj do `.env.local` (dev) lub `.env` (prod).

| Zmienna | Wymagana | Opis |
|---|---|---|
| `DATABASE_URL` | tak | Connection string PostgreSQL |
| `MINIO_ENDPOINT` | tak | URL endpointu MinIO/S3 |
| `MINIO_ACCESS_KEY` | tak | Klucz dostepu MinIO |
| `MINIO_SECRET_KEY` | tak | Sekret MinIO |
| `S3_BUCKET` | tak | Nazwa bucketa S3 (default: `omenaa-media`) |
| `S3_PUBLIC_URL` | tak | Publiczny URL do plikow w S3 |
| `NEXTAUTH_SECRET` | tak | Sekret JWT (min. 32 znaki) |
| `NEXTAUTH_URL` | tak | Bazowy URL aplikacji (z basePath) |
| `ENCRYPTION_KEY` | tak | Klucz szyfrowania TOTP (32 znaki) |
| `SMTP_HOST` | nie* | Host serwera SMTP |
| `SMTP_PORT` | nie* | Port SMTP |
| `SMTP_USER` | nie* | Login SMTP |
| `SMTP_PASS` | nie* | Haslo SMTP |
| `EMAIL_FROM` | nie | Adres nadawcy emaili |
| `STRIPE_SECRET_KEY` | nie* | Klucz tajny Stripe |
| `STRIPE_PUBLISHABLE_KEY` | nie* | Klucz publiczny Stripe |
| `STRIPE_WEBHOOK_SECRET` | nie* | Sekret webhooka Stripe |
| `REDIS_URL` | nie | URL Redis (fallback: in-memory EventEmitter) |
| `SENTRY_DSN` | nie | DSN Sentry (server-side) |
| `NEXT_PUBLIC_SENTRY_DSN` | nie | DSN Sentry (client-side) |
| `ANTHROPIC_API_KEY` | nie | Klucz API Anthropic (opisy AI) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | nie | Klucz publiczny VAPID (Web Push) |
| `VAPID_PRIVATE_KEY` | nie | Klucz prywatny VAPID |
| `VAPID_EMAIL` | nie | Email kontaktowy VAPID |

\* Wymagane w produkcji, opcjonalne w dev.

---

## Skrypty npm

| Skrypt | Polecenie | Opis |
|---|---|---|
| `dev` | `next dev --port 3002` | Serwer deweloperski (port 3002) |
| `build` | `next build` | Build produkcyjny (standalone) |
| `start` | `next start` | Start serwera produkcyjnego |
| `lint` | `eslint` | Linting kodu |
| `test` | `vitest run` | Wszystkie testy Vitest (unit + integration) |
| `test:unit` | `vitest run --project unit` | Tylko testy jednostkowe |
| `test:integration` | `vitest run --project integration` | Tylko testy integracyjne |
| `test:coverage` | `vitest run --coverage` | Testy z raportem pokrycia |
| `test:e2e` | `playwright test` | Testy E2E (Playwright) |
| `test:all` | `vitest run && playwright test` | Wszystkie testy (Vitest + Playwright) |

### Przydatne komendy Drizzle

```bash
# Utworz/zaktualizuj tabele (dev -- pushuje schemat bezposrednio)
npx drizzle-kit push

# Generuj migracje SQL (prod)
npx drizzle-kit generate

# Uruchom migracje
node db/run-migrations.mjs

# Zaladuj dane testowe
npx tsx db/seed.ts

# Otwarz Drizzle Studio (przegladarka bazy)
npx drizzle-kit studio
```
