# Plan audytu bezpieczeństwa — Omena

## Streszczenie

Omena to platforma aukcyjna (Next.js 16, TypeScript, Drizzle ORM, PostgreSQL, Stripe, S3/MinIO, SSE).
Audyt obejmuje pełny stos: autentykację, autoryzację, API, bazę danych, upload plików, płatności, kryptografię, nagłówki HTTP i zależności.

---

## Znalezione podatności — KRYTYCZNE

### K1. Bypass 2FA (TOTP) dla adminów

**Pliki:** `lib/auth.ts` (linie 44-82), `app/api/admin/login/route.ts`

**Problem:** Weryfikacja TOTP odbywa się w `/api/admin/login`, ale ten endpoint NIE tworzy sesji. Sesję tworzy NextAuth `signIn('admin-credentials')` w `lib/auth.ts`, który sprawdza TYLKO email+hasło — bez TOTP. Atakujący znający hasło może pominąć `/api/admin/login` i wywołać bezpośrednio NextAuth `signIn()`, omijając 2FA.

**Fix:** Przenieść weryfikację TOTP do NextAuth `authorize()` callback w `lib/auth.ts`, albo dodać flagę w sesji/DB (`totpVerified`) sprawdzaną przez middleware.

**Priorytet:** KRYTYCZNY — kompletne obejście 2FA

---

### K2. Rate limiter zdefiniowany, ale NIGDZIE nie zastosowany

**Pliki:** `lib/rate-limiters.ts`, `lib/rate-limit.ts`

**Problem:** Zdefiniowane są 4 limitery:
- `authLimiter` (5 req/min) — **nigdzie nie użyty**
- `adminLimiter` (30 req/min) — **nigdzie nie użyty**
- `publicApiLimiter` (100 req/min) — **nigdzie nie użyty**
- `bidLimiter` (1 req/3s) — jedyny faktycznie użyty (w `/api/lots/[id]/bids`)

Endpointy logowania (`/api/admin/login`, `/api/auth/login`) nie mają żadnej ochrony przed brute-force.

**Fix:** Podpiąć `authLimiter` do obu endpointów logowania. Podpiąć `adminLimiter` do middleware dla `/api/admin/*`. Rozważyć Redis zamiast in-memory (obecna implementacja nie działa przy wielu workerach).

**Priorytet:** KRYTYCZNY — brute-force na hasła admina bez limitu

---

### K3. Hardkodowany fallback klucza szyfrowania TOTP

**Plik:** `lib/totp.ts` (linia 5)

```typescript
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-key-32-characters-minimum-!!';
```

**Problem:** Jeśli `ENCRYPTION_KEY` nie jest ustawiony w `.env` produkcyjnym (a NIE jest ustawiony w `.env.local`), sekrety TOTP w bazie danych są szyfrowane publicznie znanym kluczem. Każdy z dostępem do DB może odszyfrować sekrety TOTP.

**Fix:** Usunąć fallback — `throw new Error()` jeśli brak zmiennej. Dodać `ENCRYPTION_KEY` do `.env.local` i wymusić w `docker-compose.yml`.

**Priorytet:** KRYTYCZNY — klucz szyfrowania w kodzie źródłowym

---

## Znalezione podatności — WYSOKIE

### W1. JWT nie jest unieważniany po zmianie roli/deaktywacji admina

**Plik:** `lib/auth.ts` — JWT `maxAge: 24h`

**Problem:** Po deaktywacji konta admina lub zmianie roli, istniejący JWT pozostaje ważny do 24h. Brak mechanizmu revokacji tokenów.

**Fix:** Dodać sprawdzanie `isActive` i `role` z DB w middleware (cache Redis z TTL 5 min) lub skrócić `maxAge` JWT do 1h + implementować refresh token.

---

### W2. SSE stream omija kontrolę widoczności aukcji

**Plik:** `app/api/sse/auction/[auctionId]/route.ts`

**Problem:** Endpoint SSE nie wymaga autentykacji. Każdy może subskrybować stream licytacji dowolnej aukcji, w tym prywatnych/VIP. Wyciekają: kwoty ofert, ID lotów, timestampy — w czasie rzeczywistym.

**Fix:** Dodać walidację sesji i sprawdzanie `visibilityLevel` aukcji w handlerze SSE. Dla aukcji VIP wymagać rejestracji.

---

### W3. Brak walidacji wejścia w `/api/admin/login`

**Plik:** `app/api/admin/login/route.ts`

**Problem:** JSON body jest parsowany bez Zod — `email`, `password`, `totpCode` są cast'owane jako `string` bez walidacji typu, długości, formatu. Potencjał: duże payloady, niespodziewane typy.

**Fix:** Dodać Zod schema (analogicznie do `loginSchema` z `lib/validation/user.ts`).

---

### W4. Rejestracja użytkownika z opcjonalnym hasłem

**Plik:** `lib/validation/user.ts` (linia 26)

```typescript
password: z.string().min(8, ...).optional()
```

**Problem:** Użytkownik może zarejestrować się bez hasła (`passwordHash = null` w DB). Takie konto nie może się zalogować, ale zajmuje adres email i nie może być odzyskane.

**Fix:** Albo wymusić hasło (`password: z.string().min(8)`), albo dodać magic-link/OAuth flow, albo odmówić rejestracji bez hasła.

---

## Znalezione podatności — ŚREDNIE

### S1. Brak nagłówków bezpieczeństwa HTTP

**Pliki:** `middleware.ts`, `next.config.ts`

**Brak:**
- `Content-Security-Policy` — brak ochrony przed XSS, inline script injection
- `X-Frame-Options` / `frame-ancestors` — brak ochrony przed clickjacking
- `X-Content-Type-Options: nosniff` — brak ochrony MIME sniffing
- `Strict-Transport-Security` — brak wymuszania HTTPS
- `Referrer-Policy`
- `Permissions-Policy`

**Fix:** Dodać nagłówki w `next.config.ts` `headers()` lub w middleware.

---

### S2. MIME type uploadu walidowany po stronie klienta

**Plik:** `app/api/admin/media/upload/route.ts`

**Problem:** `file.type` jest sprawdzany, ale pochodzi z Content-Type multipart (kontrolowany przez klienta). `sharp` pośrednio waliduje (rzuca na nie-obrazy), ale brak jawnej walidacji magic bytes.

**Fix:** Sprawdzać file magic bytes (np. `file-type` npm) lub polegać wyłącznie na `sharp.metadata()` z jawnym error handling.

---

### S3. Rate limiting in-memory — nieskuteczne w multi-worker

**Plik:** `lib/rate-limit.ts`

**Problem:** Token bucket w pamięci procesu. Przy wielu workerach Next.js (lub wielu kontenerach Docker), każdy worker ma osobny stan. Rate limiter jest łatwy do obejścia.

**Fix:** Przenieść na Redis (`ioredis` + sliding window) lub użyć Upstash Rate Limit.

---

### S4. next-auth@5.0.0-beta w produkcji

**Plik:** `package.json`

**Problem:** Auth.js v5 to oprogramowanie beta — mogą istnieć niezałatane luki bezpieczeństwa, API może się zmienić.

**Fix:** Monitorować CVE. Rozważyć pin do konkretnej wersji beta i aktualizować ręcznie.

---

### S5. `otplib` — nieużywana zależność TOTP

**Plik:** `package.json`

**Problem:** Zainstalowane dwie biblioteki TOTP: `otplib@13.3.0` i `otpauth@9.5.0`. Tylko `otpauth` jest używany. `otplib` to martwa zależność zwiększająca attack surface.

**Fix:** `npm uninstall otplib`

---

### S6. Brak CORS dla API v1

**Problem:** Publiczne API v1 (z API key) nie ma nagłówków CORS. Klienci browserowi z innych domen nie mogą go użyć.

**Fix:** Jeśli API ma być dostępne cross-origin, dodać CORS headers. Jeśli nie — udokumentować jako server-to-server only.

---

### S7. Nagłówki `x-user-*` w middleware

**Plik:** `middleware.ts` (linie 57-61)

**Problem:** Middleware ustawia `x-user-visibility`, `x-user-id`, `x-user-type` w response headers. Te nagłówki są widoczne dla klienta w DevTools i mogą wyciekać informacje o roli/ID użytkownika. Nie stanowią bezpośredniej podatności, ale łamią zasadę minimalnego ujawniania.

**Fix:** Przenieść te dane na request headers (wewnętrzne) lub usunąć, jeśli nie są potrzebne (auth-utils używa `auth()`, nie headers).

---

## Znalezione podatności — NISKIE

### N1. Double PaymentIntent race condition

**Plik:** `app/api/payments/create-intent/route.ts`

**Problem:** Sprawdzenie czy istnieje pending payment i stworzenie nowego PaymentIntent nie jest atomowe. Dwa jednoczesne requesty mogą stworzyć dwa PaymentIntenty.

**Fix:** Advisory lock na `invoiceId` lub `SELECT FOR UPDATE` w transakcji.

---

### N2. Wyciek szczegółów błędów Stripe do klienta

**Plik:** `app/api/payments/create-intent/route.ts` (linia 64)

```typescript
return NextResponse.json({ error: error.message }, { status: 400 });
```

**Problem:** Pełna wiadomość błędu Stripe (z wewnętrznymi ID) jest przekazywana do autentykowanego użytkownika.

**Fix:** Mapować błędy Stripe na generyczne komunikaty.

---

### N3. Brak UUID walidacji w endpointach analitycznych

**Plik:** `db/queries/analytics.ts`

**Problem:** `auctionId` z query params trafia do SQL bez walidacji UUID format (jest parametryzowany, więc nie ma SQL injection, ale niepotrzebnie obciąża DB).

**Fix:** Walidować `z.string().uuid()` w route handlerach.

---

### N4. Wyszukiwanie ILIKE na JSONB — potencjalny performance DoS

**Plik:** `db/queries/lots.ts`

**Problem:** Pattern `%${query}%` na kolumnach JSONB (provenance, exhibitions, literature) rzutowanych na text. Długi ciąg wyszukiwania może spowodować wolne full-scan.

**Fix:** Dodać limit długości query (np. max 200 znaków). Rozważyć full-text search (tsvector) zamiast ILIKE.

---

### N5. `visibilityLevel` w wyszukiwaniu ignoruje zalogowanego użytkownika

**Plik:** `app/api/lots/search/route.ts`

**Problem:** `userVisibility` jest hardkodowane na `0` (publiczne) — zalogowani użytkownicy VIP nie widzą prywatnych lotów w wynikach wyszukiwania.

**Fix:** Odczytać sesję i ustawić odpowiedni `visibilityLevel`.

---

### N6. SSE EventSource bez basePath

**Plik:** `app/lib/useRealtimeBids.ts`

**Problem:** `new EventSource('/api/sse/auction/${auctionId}')` nie używa `apiUrl()` — pomija prefix `/omena`. Przy deploy pod basePath SSE nie połączy się (404).

**Fix:** Użyć `apiUrl(`/api/sse/auction/${auctionId}`)`.

---

### N7. API Keys bez permission scope

**Plik:** `app/api/admin/api-keys/` — `requireAdmin()` bez argumentu

**Problem:** Dowolny admin (nawet `viewer`) może zarządzać kluczami API, bo brak uprawnienia `settings:manage` w `requireAdmin()`.

**Fix:** Zmienić na `requireAdmin('settings:manage')`.

---

## Plan naprawy — priorytety

### Faza 1 — NATYCHMIAST (krytyczne + wysokie)

| # | Issue | Trudność | Pliki do zmiany |
|---|-------|----------|-----------------|
| K1 | Bypass 2FA | Średnia | `lib/auth.ts`, `app/api/admin/login/route.ts` |
| K2 | Rate limiter nieaktywny | Niska | `app/api/admin/login/route.ts`, `app/api/auth/login/route.ts` |
| K3 | Hardkodowany ENCRYPTION_KEY | Niska | `lib/totp.ts`, `.env.local`, `docker-compose.yml` |
| W1 | JWT revokacja | Średnia | `middleware.ts`, nowa tabela/cache |
| W2 | SSE bez auth | Niska | `app/api/sse/auction/[auctionId]/route.ts` |
| W3 | Brak walidacji admin login | Niska | `app/api/admin/login/route.ts` |
| W4 | Opcjonalne hasło | Niska | `lib/validation/user.ts` |

### Faza 2 — TYDZIEŃ (średnie)

| # | Issue | Trudność |
|---|-------|----------|
| S1 | Nagłówki HTTP | Niska |
| S2 | MIME magic bytes | Niska |
| S3 | Redis rate limiting | Średnia |
| S5 | Usunięcie otplib | Trywialna |
| S7 | Usunięcie x-user-* z response | Niska |

### Faza 3 — MIESIĄC (niskie + hardening)

| # | Issue |
|---|-------|
| N1-N7 | Wszystkie niskie |
| - | `npm audit` + aktualizacja zależności |
| - | Penetration test (OWASP ZAP / Burp) |
| - | Konfiguracja CSP (raport-only → enforce) |
| - | Dodanie logowania security events (failed login, TOTP fail, permission denied) |
| - | Backup/recovery test klucza ENCRYPTION_KEY |

---

## Scope poza audytem (wymagają osobnej analizy)

- Infrastruktura (Docker, nginx, TLS, DNS)
- Bezpieczeństwo PostgreSQL (role, SSL, backup encryption)
- S3/MinIO ACL i bucket policy
- Stripe PCI compliance
- Konfiguracja serwera produkcyjnego (Hetzner)
- DDoS protection (Cloudflare/WAF)
