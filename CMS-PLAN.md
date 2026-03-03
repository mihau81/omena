# Omenaa CMS — Master Architecture Plan

> **Version**: 1.0
> **Date**: 2026-02-27
> **Status**: Draft — awaiting approval

---

## Table of Contents

1. [Tech Stack Decision](#1-tech-stack-decision)
2. [Database Schema](#2-database-schema)
3. [Access Control Design](#3-access-control-design)
4. [API Endpoints](#4-api-endpoints)
5. [Admin Panel Design](#5-admin-panel-design)
6. [Migration Strategy](#6-migration-strategy)
7. [Additional Features](#7-additional-features)
8. [Implementation Phases](#8-implementation-phases)

---

## 1. Tech Stack Decision

### Database: PostgreSQL

**Choice**: PostgreSQL 16+

**Justification**:
- Native JSON/JSONB columns for flexible metadata (provenance arrays, exhibition lists) without sacrificing relational integrity
- Row-level security (RLS) — ideal for implementing visibility levels (0/1/2) at the database layer
- Full-text search in Polish via `pg_trgm` + custom dictionary — eliminates need for Elasticsearch for catalog search
- Range types for auction date windows (`tstzrange`)
- Advisory locks for bid race-condition safety
- Mature ecosystem, excellent with Next.js hosting stacks (Vercel Postgres, Supabase, Railway, self-hosted)
- Proven at scale for auction platforms (Christie's, Heritage Auctions use PostgreSQL)

### ORM: Drizzle

**Choice**: Drizzle ORM

**Justification**:
- **Type safety**: SQL-like syntax with full TypeScript inference — schema changes break at compile time, not runtime
- **Performance**: Zero overhead — generates plain SQL, no query engine abstraction layer. Critical for bid-placement hot paths
- **Migrations**: `drizzle-kit` generates SQL migration files that can be reviewed, versioned, and applied deterministically. No "shadow database" like Prisma
- **Lightweight**: ~50KB bundle vs Prisma's ~2MB engine binary. Matters for serverless cold starts (Vercel Edge, AWS Lambda)
- **Relational queries**: `drizzle-orm/pg-core` supports joins, subqueries, CTEs natively — no need to learn a DSL
- **Raw SQL escape hatch**: When needed for complex audit-log triggers or RLS policies, drop to raw SQL without friction
- **Next.js 16 alignment**: Works with React Server Components and streaming without issues. No binary compatibility headaches across platforms

**Why not Prisma**: Prisma's query engine binary adds cold-start latency on serverless. Its migration system uses a shadow database which complicates CI/CD. The Prisma Client's abstraction layer makes complex queries (CTEs for audit logs, window functions for bid history) awkward. Drizzle's SQL-first approach is better suited to an auction platform where query performance and precision matter.

### Admin Panel: Custom Next.js Admin Routes

**Choice**: Custom admin panel built with Next.js App Router (`/admin/...` routes)

**Justification**:
- **Unified codebase**: No separate deployment, shared types/utils/components, single CI/CD pipeline
- **Full control**: Auction workflows (DRAFT → PREVIEW → LIVE → ARCHIVE) require custom UI that generic admin panels can't provide out-of-the-box
- **Visibility system**: The 3-tier access control is domain-specific — easier to bake into custom middleware than to configure in AdminJS/Payload
- **Drag-and-drop lot ordering**: Custom implementation with `@dnd-kit/core` integrates naturally into Next.js pages
- **Localization**: Already have i18n infrastructure — admin panel inherits it
- **Smaller surface area**: No third-party admin framework dependency to maintain, audit, or upgrade

**Why not Payload CMS**: Payload is excellent for generic content, but auction-specific workflows (bid management, lot lifecycle, visibility inheritance, paddle assignment) would require extensive customization that negates the time savings. We'd fight the framework more than benefit from it.

**Why not AdminJS**: Same reasoning — plus AdminJS's React admin components use an older React pattern incompatible with Server Components.

### API: Next.js API Routes (App Router)

**Choice**: Next.js Route Handlers (`app/api/...`)

**Justification**:
- **Co-located with frontend**: Shared types, validation schemas, and database connection pool
- **Server Actions**: For admin mutations (create/update auction, manage lots), use Server Actions — eliminates boilerplate API routes for form submissions
- **Route Handlers**: For public data fetching and real-time endpoints (bid WebSocket upgrade)
- **Middleware**: Next.js middleware for auth checks and visibility filtering — runs at the edge
- **ISR/SSR**: Route Handlers integrate naturally with `revalidateTag()` / `revalidatePath()` for cache invalidation after CMS changes

**Why not tRPC**: tRPC adds type-safe RPC on top of Next.js — useful for large teams, but for this project the added abstraction layer isn't justified. Next.js Server Actions already provide type-safe server mutations. Route Handlers provide sufficient structure for REST endpoints.

**Why not separate backend**: A separate Express/Fastify backend doubles infrastructure, complicates deployment, and provides no benefit given Next.js's built-in API capabilities. The auction platform doesn't need microservices at this scale.

### Image Storage: S3-compatible + Local Fallback

**Choice**: S3-compatible object storage (MinIO for self-hosted, AWS S3 for cloud)

**Justification**:
- **Current state**: 38 images in `public/images/` — manageable now, but a growing auction catalog will need proper media management
- **MinIO**: Drop-in S3-compatible storage, runs alongside PostgreSQL in Docker Compose for development and self-hosted production
- **CDN-ready**: Serve via Cloudflare R2 or S3 + CloudFront with auto-resizing (Sharp/Imgproxy)
- **Image processing pipeline**: Upload → generate thumbnails (400px, 800px, 1600px) → store all variants → serve responsive `<Image>` srcSet
- **Existing images**: Migrate from `public/images/` to S3 during database seeding

**Image processing stack**:
- `sharp` for server-side resize/optimize on upload
- Store original + 3 variants (thumb_400, medium_800, large_1600)
- Serve via Next.js `<Image>` with `loader` pointing to S3/MinIO URL

### Auth: Auth.js (NextAuth v5)

**Choice**: Auth.js v5 (formerly NextAuth.js)

**Justification**:
- **Two auth domains**:
  1. **Admin auth**: Email/password with TOTP 2FA for admin accounts
  2. **Client auth**: Email magic link + optional password for auction clients
- **Session strategy**: JWT tokens (stateless, works with Edge middleware for visibility checks)
- **Built-in adapters**: Drizzle adapter available — session/account tables integrate with our schema
- **Role/permission embedding**: JWT payload includes `role` and `visibility_level` — checked in middleware on every request
- **Self-hosted compatible**: No dependency on external auth services (Clerk, Auth0)

---

## 2. Database Schema

### Drizzle Schema Definition

```typescript
// db/schema.ts

import {
  pgTable, pgEnum,
  uuid, text, varchar, integer, boolean, timestamp, numeric,
  jsonb, serial, index, uniqueIndex, foreignKey, check,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const visibilityLevelEnum = pgEnum('visibility_level', ['0', '1', '2']);
// 0 = Public, 1 = Private, 2 = VIP

export const auctionStatusEnum = pgEnum('auction_status', [
  'draft',        // Being prepared, not visible to anyone except admins
  'preview',      // Catalog visible to eligible users, bidding not open
  'live',         // Bidding is active
  'reconciliation', // Bidding closed, results being verified
  'archive',      // Fully concluded, read-only
]);

export const lotStatusEnum = pgEnum('lot_status', [
  'draft',        // Being prepared
  'catalogued',   // Data complete, awaiting publication
  'published',    // Visible per visibility rules, not yet biddable
  'active',       // Open for bidding
  'sold',         // Hammer price achieved
  'passed',       // Did not meet reserve / no bids
  'withdrawn',    // Removed from auction before/during sale
]);

export const adminRoleEnum = pgEnum('admin_role', [
  'super_admin',  // Full access, can manage other admins
  'admin',        // Full CMS access, cannot manage super_admin accounts
  'cataloguer',   // Can manage lots, images, descriptions
  'auctioneer',   // Can manage live auction flow, accept bids
  'viewer',       // Read-only admin access (auditors, interns)
]);

export const mediaTypeEnum = pgEnum('media_type', [
  'image',
  'youtube',
]);

export const bidTypeEnum = pgEnum('bid_type', [
  'online',       // Placed through website
  'phone',        // Phone bid entered by auctioneer
  'floor',        // In-room bid entered by auctioneer
  'absentee',     // Pre-submitted maximum bid
  'system',       // Auto-bid from absentee proxy
]);

// ─── Auctions ────────────────────────────────────────────────────────────────

export const auctions = pgTable('auctions', {
  id:               uuid('id').defaultRandom().primaryKey(),
  slug:             varchar('slug', { length: 255 }).notNull().unique(),
  title:            text('title').notNull(),
  description:      text('description').notNull().default(''),
  category:         varchar('category', { length: 50 }).notNull().default('mixed'),
  coverImageId:     uuid('cover_image_id'),  // FK to media table, set after insert
  startDate:        timestamp('start_date', { withTimezone: true }).notNull(),
  endDate:          timestamp('end_date', { withTimezone: true }).notNull(),
  location:         text('location').notNull().default(''),
  curator:          text('curator').notNull().default(''),
  status:           auctionStatusEnum('status').notNull().default('draft'),
  visibilityLevel:  visibilityLevelEnum('visibility_level').notNull().default('0'),
  sortOrder:        integer('sort_order').notNull().default(0),
  buyersPremiumRate: numeric('buyers_premium_rate', { precision: 5, scale: 4 })
                      .notNull().default('0.2000'),  // 20% default
  notes:            text('notes').default(''),  // Internal admin notes
  // Soft delete & audit
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at', { withTimezone: true }),
  createdBy:        uuid('created_by'),  // FK to admins
  updatedBy:        uuid('updated_by'),  // FK to admins
}, (table) => [
  index('auctions_status_idx').on(table.status),
  index('auctions_visibility_idx').on(table.visibilityLevel),
  index('auctions_sort_order_idx').on(table.sortOrder),
  index('auctions_deleted_at_idx').on(table.deletedAt),
]);

// ─── Lots ────────────────────────────────────────────────────────────────────

export const lots = pgTable('lots', {
  id:               uuid('id').defaultRandom().primaryKey(),
  auctionId:        uuid('auction_id').notNull().references(() => auctions.id),
  lotNumber:        integer('lot_number').notNull(),
  title:            text('title').notNull(),
  artist:           text('artist').notNull().default(''),
  description:      text('description').notNull().default(''),
  medium:           text('medium').notNull().default(''),
  dimensions:       text('dimensions').notNull().default(''),
  year:             integer('year'),
  estimateMin:      integer('estimate_min').notNull().default(0),  // in PLN (grosz precision not needed for art)
  estimateMax:      integer('estimate_max').notNull().default(0),
  reservePrice:     integer('reserve_price'),  // Secret minimum — null = no reserve
  startingBid:      integer('starting_bid'),   // Override for opening bid
  hammerPrice:      integer('hammer_price'),    // Final sale price (null if unsold)
  status:           lotStatusEnum('status').notNull().default('draft'),
  // Visibility: null = inherit from auction, explicit value = override
  visibilityOverride: visibilityLevelEnum('visibility_override'),
  sortOrder:        integer('sort_order').notNull().default(0),
  provenance:       jsonb('provenance').notNull().default('[]'),     // string[]
  exhibitions:      jsonb('exhibitions').notNull().default('[]'),    // string[]
  literature:       jsonb('literature').notNull().default('[]'),     // string[] (bibliography)
  conditionNotes:   text('condition_notes').default(''),
  notes:            text('notes').default(''),  // Internal admin notes
  // Soft delete & audit
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at', { withTimezone: true }),
  createdBy:        uuid('created_by'),
  updatedBy:        uuid('updated_by'),
}, (table) => [
  index('lots_auction_id_idx').on(table.auctionId),
  index('lots_status_idx').on(table.status),
  index('lots_sort_order_idx').on(table.sortOrder),
  index('lots_artist_idx').on(table.artist),
  uniqueIndex('lots_auction_lot_number_idx').on(table.auctionId, table.lotNumber),
  index('lots_deleted_at_idx').on(table.deletedAt),
]);

// ─── Media (lot images + YouTube) ────────────────────────────────────────────

export const media = pgTable('media', {
  id:               uuid('id').defaultRandom().primaryKey(),
  lotId:            uuid('lot_id').references(() => lots.id),  // nullable — can be used for auction covers too
  auctionId:        uuid('auction_id').references(() => auctions.id),
  mediaType:        mediaTypeEnum('media_type').notNull().default('image'),
  // For images: S3 key / URL. For YouTube: full YouTube URL
  url:              text('url').notNull(),
  // Image variants (null for YouTube)
  thumbnailUrl:     text('thumbnail_url'),    // 400px
  mediumUrl:        text('medium_url'),        // 800px
  largeUrl:         text('large_url'),         // 1600px
  originalFilename: text('original_filename'),
  mimeType:         varchar('mime_type', { length: 100 }),
  fileSize:         integer('file_size'),       // bytes
  width:            integer('width'),
  height:           integer('height'),
  altText:          text('alt_text').default(''),
  sortOrder:        integer('sort_order').notNull().default(0),
  isPrimary:        boolean('is_primary').notNull().default(false),
  // Soft delete & audit
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at', { withTimezone: true }),
  uploadedBy:       uuid('uploaded_by'),
}, (table) => [
  index('media_lot_id_idx').on(table.lotId),
  index('media_auction_id_idx').on(table.auctionId),
  index('media_sort_order_idx').on(table.sortOrder),
]);

// ─── Users (Auction Clients) ─────────────────────────────────────────────────

export const users = pgTable('users', {
  id:               uuid('id').defaultRandom().primaryKey(),
  email:            varchar('email', { length: 320 }).notNull().unique(),
  passwordHash:     text('password_hash'),  // null if using magic link only
  name:             text('name').notNull(),
  phone:            varchar('phone', { length: 30 }).default(''),
  address:          text('address').default(''),
  city:             varchar('city', { length: 100 }).default(''),
  postalCode:       varchar('postal_code', { length: 20 }).default(''),
  country:          varchar('country', { length: 100 }).default('Poland'),
  visibilityLevel:  visibilityLevelEnum('visibility_level').notNull().default('0'),
  referrerId:       uuid('referrer_id'),  // FK to self — who referred this user
  notes:            text('notes').default(''),  // Admin-editable notes
  emailVerified:    boolean('email_verified').notNull().default(false),
  isActive:         boolean('is_active').notNull().default(true),
  // Soft delete & audit
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('users_email_idx').on(table.email),
  index('users_visibility_idx').on(table.visibilityLevel),
  index('users_referrer_idx').on(table.referrerId),
  index('users_deleted_at_idx').on(table.deletedAt),
]);

// Self-referencing FK for referrer
// Applied via migration ALTER TABLE after table creation

// ─── Admins ──────────────────────────────────────────────────────────────────

export const admins = pgTable('admins', {
  id:               uuid('id').defaultRandom().primaryKey(),
  email:            varchar('email', { length: 320 }).notNull().unique(),
  passwordHash:     text('password_hash').notNull(),
  name:             text('name').notNull(),
  role:             adminRoleEnum('role').notNull().default('viewer'),
  totpSecret:       text('totp_secret'),   // Encrypted TOTP seed for 2FA
  totpEnabled:      boolean('totp_enabled').notNull().default(false),
  isActive:         boolean('is_active').notNull().default(true),
  lastLoginAt:      timestamp('last_login_at', { withTimezone: true }),
  // Soft delete & audit
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at', { withTimezone: true }),
  createdBy:        uuid('created_by'),  // Which admin created this admin
}, (table) => [
  index('admins_email_idx').on(table.email),
  index('admins_role_idx').on(table.role),
]);

// ─── Bid Registrations (paddle assignments per auction) ──────────────────────

export const bidRegistrations = pgTable('bid_registrations', {
  id:               uuid('id').defaultRandom().primaryKey(),
  userId:           uuid('user_id').notNull().references(() => users.id),
  auctionId:        uuid('auction_id').notNull().references(() => auctions.id),
  paddleNumber:     integer('paddle_number').notNull(),
  isApproved:       boolean('is_approved').notNull().default(false),
  approvedBy:       uuid('approved_by').references(() => admins.id),
  approvedAt:       timestamp('approved_at', { withTimezone: true }),
  depositPaid:      boolean('deposit_paid').notNull().default(false),
  notes:            text('notes').default(''),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('bid_reg_user_auction_idx').on(table.userId, table.auctionId),
  uniqueIndex('bid_reg_paddle_auction_idx').on(table.paddleNumber, table.auctionId),
]);

// ─── Bids (immutable, append-only) ──────────────────────────────────────────

export const bids = pgTable('bids', {
  id:               uuid('id').defaultRandom().primaryKey(),
  lotId:            uuid('lot_id').notNull().references(() => lots.id),
  userId:           uuid('user_id').references(() => users.id),  // null for floor/phone bids
  registrationId:   uuid('registration_id').references(() => bidRegistrations.id),
  amount:           integer('amount').notNull(),  // PLN
  bidType:          bidTypeEnum('bid_type').notNull().default('online'),
  paddleNumber:     integer('paddle_number'),
  isWinning:        boolean('is_winning').notNull().default(false),
  // Immutable — no update/delete columns. Bids are NEVER modified or removed.
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress:        varchar('ip_address', { length: 45 }),  // For fraud detection
  userAgent:        text('user_agent'),
}, (table) => [
  index('bids_lot_id_idx').on(table.lotId),
  index('bids_user_id_idx').on(table.userId),
  index('bids_created_at_idx').on(table.createdAt),
  index('bids_amount_idx').on(table.lotId, table.amount),
]);

// NOTE: No deletedAt on bids — bids are immutable audit records.
// A bid can only be *retracted* by creating a bid_retraction record (admin action with reason).

export const bidRetractions = pgTable('bid_retractions', {
  id:               uuid('id').defaultRandom().primaryKey(),
  bidId:            uuid('bid_id').notNull().references(() => bids.id).unique(),
  reason:           text('reason').notNull(),
  retractedBy:      uuid('retracted_by').notNull().references(() => admins.id),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Absentee Bids (pre-submitted max bids) ─────────────────────────────────

export const absenteeBids = pgTable('absentee_bids', {
  id:               uuid('id').defaultRandom().primaryKey(),
  lotId:            uuid('lot_id').notNull().references(() => lots.id),
  userId:           uuid('user_id').notNull().references(() => users.id),
  maxAmount:        integer('max_amount').notNull(),  // Maximum the system will bid up to
  isActive:         boolean('is_active').notNull().default(true),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('absentee_bids_lot_idx').on(table.lotId),
  uniqueIndex('absentee_bids_lot_user_idx').on(table.lotId, table.userId),
]);

// ─── Watched Lots ────────────────────────────────────────────────────────────

export const watchedLots = pgTable('watched_lots', {
  userId:           uuid('user_id').notNull().references(() => users.id),
  lotId:            uuid('lot_id').notNull().references(() => lots.id),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.lotId] }),
]);

// ─── Audit Log ───────────────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id:               serial('id').primaryKey(),  // Auto-increment for ordering
  tableName:        varchar('table_name', { length: 100 }).notNull(),
  recordId:         uuid('record_id').notNull(),
  action:           varchar('action', { length: 10 }).notNull(),  // INSERT, UPDATE, DELETE
  oldData:          jsonb('old_data'),      // Previous row state (null for INSERT)
  newData:          jsonb('new_data'),      // New row state (null for DELETE)
  changedFields:    jsonb('changed_fields'), // Array of field names that changed
  performedBy:      uuid('performed_by'),    // Admin or user who made the change
  performedByType:  varchar('performed_by_type', { length: 10 }),  // 'admin' | 'user' | 'system'
  ipAddress:        varchar('ip_address', { length: 45 }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_log_table_record_idx').on(table.tableName, table.recordId),
  index('audit_log_performed_by_idx').on(table.performedBy),
  index('audit_log_created_at_idx').on(table.createdAt),
  index('audit_log_action_idx').on(table.action),
]);

// NOTE: The audit_log table is append-only. It should be populated via:
// 1. Application-level middleware (preferred — captures who made the change)
// 2. PostgreSQL triggers as a safety net (catches raw SQL changes)

// ─── Sessions (for Auth.js) ─────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id:               uuid('id').defaultRandom().primaryKey(),
  sessionToken:     text('session_token').notNull().unique(),
  userId:           uuid('user_id').notNull(),  // References users OR admins
  userType:         varchar('user_type', { length: 10 }).notNull(),  // 'user' | 'admin'
  expiresAt:        timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sessions_token_idx').on(table.sessionToken),
  index('sessions_expires_idx').on(table.expiresAt),
]);

// ─── Verification Tokens (magic links, email verification) ──────────────────

export const verificationTokens = pgTable('verification_tokens', {
  identifier:       varchar('identifier', { length: 320 }).notNull(),  // email
  token:            text('token').notNull().unique(),
  expiresAt:        timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id:               uuid('id').defaultRandom().primaryKey(),
  userId:           uuid('user_id').notNull().references(() => users.id),
  type:             varchar('type', { length: 50 }).notNull(),
  // Types: 'outbid', 'auction_starting', 'auction_ending', 'lot_won', 'lot_passed',
  //        'registration_approved', 'payment_reminder', 'invoice_ready'
  title:            text('title').notNull(),
  body:             text('body').notNull(),
  metadata:         jsonb('metadata').default('{}'),  // { lotId, auctionId, bidId, etc. }
  isRead:           boolean('is_read').notNull().default(false),
  emailSent:        boolean('email_sent').notNull().default(false),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('notifications_user_idx').on(table.userId),
  index('notifications_unread_idx').on(table.userId, table.isRead),
  index('notifications_created_at_idx').on(table.createdAt),
]);

// ─── Invoices (Phase 2, but schema designed now) ────────────────────────────

export const invoices = pgTable('invoices', {
  id:               uuid('id').defaultRandom().primaryKey(),
  invoiceNumber:    varchar('invoice_number', { length: 50 }).notNull().unique(),
  userId:           uuid('user_id').notNull().references(() => users.id),
  auctionId:        uuid('auction_id').notNull().references(() => auctions.id),
  lotId:            uuid('lot_id').notNull().references(() => lots.id),
  hammerPrice:      integer('hammer_price').notNull(),
  buyersPremium:    integer('buyers_premium').notNull(),
  totalAmount:      integer('total_amount').notNull(),
  currency:         varchar('currency', { length: 3 }).notNull().default('PLN'),
  status:           varchar('status', { length: 20 }).notNull().default('pending'),
  // Status: 'pending', 'sent', 'paid', 'overdue', 'cancelled'
  dueDate:          timestamp('due_date', { withTimezone: true }),
  paidAt:           timestamp('paid_at', { withTimezone: true }),
  notes:            text('notes').default(''),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Entity-Relationship Summary

```
auctions 1──∞ lots 1──∞ media
auctions 1──∞ bid_registrations
lots     1──∞ bids
lots     1──∞ absentee_bids
lots     1──∞ watched_lots
users    1──∞ bid_registrations
users    1──∞ bids
users    1──∞ watched_lots
users    1──∞ notifications
users    1──∞ invoices
users    ?──1 users (referrer, self-FK)
admins   1──∞ bid_retractions
bids     1──? bid_retractions

audit_log — polymorphic, references any table by name + record_id
sessions  — polymorphic, references users or admins by user_type
```

### Database Triggers (applied via migration SQL)

```sql
-- Auto-update `updated_at` on any row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_auctions_updated_at
  BEFORE UPDATE ON auctions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_lots_updated_at
  BEFORE UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_admins_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Safety net audit trigger (catches changes not going through the app layer)
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, performed_by_type)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), 'system');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, performed_by_type)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), 'system');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, performed_by_type)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), 'system');
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables
CREATE TRIGGER trg_audit_auctions
  AFTER INSERT OR UPDATE OR DELETE ON auctions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_lots
  AFTER INSERT OR UPDATE OR DELETE ON lots
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_bids
  AFTER INSERT ON bids  -- bids are insert-only
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

### Soft Delete Convention

All entities except `bids` and `audit_log` use `deleted_at TIMESTAMP WITH TIME ZONE`:
- `NULL` = active record
- Non-null = soft-deleted (with timestamp of deletion)
- All queries include `WHERE deleted_at IS NULL` by default (enforced via Drizzle helper)
- Drizzle helper:

```typescript
// db/helpers.ts
import { isNull } from 'drizzle-orm';

export function notDeleted<T extends { deletedAt: any }>(table: T) {
  return isNull(table.deletedAt);
}
```

---

## 3. Access Control Design

### 3.1 Visibility Levels — How They Work

The visibility system has three levels:
- **Level 0 (Public)**: Default. Content visible to everyone including unauthenticated users.
- **Level 1 (Private)**: Visible only to authenticated users with `visibility_level >= 1`.
- **Level 2 (VIP)**: Visible only to users with `visibility_level = 2`.

**Rule**: A user sees content at their level AND all levels below. A VIP user (level 2) sees everything. A public user (level 0) sees only public content.

#### Implementation: Middleware + Per-Query Filter

**Layer 1 — Next.js Middleware** (`middleware.ts`):

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const userVisibility = token?.visibilityLevel ?? 0;

  // Inject visibility level into request headers for use by Server Components
  const response = NextResponse.next();
  response.headers.set('x-user-visibility', String(userVisibility));
  response.headers.set('x-user-id', token?.sub ?? '');
  response.headers.set('x-user-type', token?.userType ?? 'anonymous');

  return response;
}
```

**Layer 2 — Database Query Helper**:

```typescript
// db/visibility.ts
import { lte, or, isNull, and } from 'drizzle-orm';
import { auctions, lots } from './schema';

export function auctionVisibilityFilter(userVisibility: number) {
  return and(
    lte(auctions.visibilityLevel, String(userVisibility)),
    isNull(auctions.deletedAt),
  );
}

export function lotVisibilityFilter(userVisibility: number, auctionVisibility: number) {
  // If lot has visibilityOverride, use it. Otherwise, inherit from auction.
  return and(
    isNull(lots.deletedAt),
    or(
      // Lot has explicit override — check against user level
      and(
        lots.visibilityOverride.isNotNull(),
        lte(lots.visibilityOverride, String(userVisibility)),
      ),
      // Lot inherits from auction — auction visibility already checked
      and(
        isNull(lots.visibilityOverride),
        lte(auctions.visibilityLevel, String(userVisibility)),
      ),
    ),
  );
}
```

**Layer 3 — Server Component Data Fetching**:

```typescript
// app/[locale]/auctions/page.tsx (example)
import { headers } from 'next/headers';

export default async function AuctionsPage() {
  const headersList = await headers();
  const visibility = parseInt(headersList.get('x-user-visibility') || '0');

  const visibleAuctions = await db
    .select()
    .from(auctions)
    .where(auctionVisibilityFilter(visibility))
    .orderBy(auctions.sortOrder);

  // render...
}
```

### 3.2 Admin Roles & Permissions Matrix

| Action                        | super_admin | admin | cataloguer | auctioneer | viewer |
|-------------------------------|:-----------:|:-----:|:----------:|:----------:|:------:|
| View admin dashboard          |      Y      |   Y   |     Y      |     Y      |   Y    |
| Manage auctions (CRUD)        |      Y      |   Y   |     N      |     N      |   N    |
| Change auction status         |      Y      |   Y   |     N      |     Y      |   N    |
| Manage lots (CRUD)            |      Y      |   Y   |     Y      |     N      |   N    |
| Upload/manage media           |      Y      |   Y   |     Y      |     N      |   N    |
| Manage lot ordering           |      Y      |   Y   |     Y      |     N      |   N    |
| Enter bids (phone/floor)      |      Y      |   Y   |     N      |     Y      |   N    |
| Retract bids                  |      Y      |   Y   |     N      |     Y      |   N    |
| Manage users/clients          |      Y      |   Y   |     N      |     N      |   N    |
| Change user visibility level  |      Y      |   Y   |     N      |     N      |   N    |
| Manage bid registrations      |      Y      |   Y   |     N      |     Y      |   N    |
| View audit log                |      Y      |   Y   |     N      |     N      |   Y    |
| Manage admin accounts         |      Y      |   N   |     N      |     N      |   N    |
| System settings               |      Y      |   N   |     N      |     N      |   N    |
| View reports/analytics        |      Y      |   Y   |     N      |     N      |   Y    |
| Manage invoices               |      Y      |   Y   |     N      |     N      |   N    |

#### Implementation:

```typescript
// lib/permissions.ts

type Permission =
  | 'auctions:read' | 'auctions:write' | 'auctions:status'
  | 'lots:read' | 'lots:write' | 'lots:order'
  | 'media:write'
  | 'bids:enter' | 'bids:retract'
  | 'users:read' | 'users:write' | 'users:visibility'
  | 'registrations:manage'
  | 'audit:read'
  | 'admins:manage'
  | 'settings:manage'
  | 'reports:read'
  | 'invoices:manage';

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: ['*'],  // All permissions
  admin: [
    'auctions:read', 'auctions:write', 'auctions:status',
    'lots:read', 'lots:write', 'lots:order', 'media:write',
    'bids:enter', 'bids:retract',
    'users:read', 'users:write', 'users:visibility',
    'registrations:manage', 'audit:read', 'reports:read',
    'invoices:manage',
  ],
  cataloguer: [
    'auctions:read', 'lots:read', 'lots:write', 'lots:order', 'media:write',
  ],
  auctioneer: [
    'auctions:read', 'auctions:status',
    'lots:read', 'bids:enter', 'bids:retract',
    'registrations:manage',
  ],
  viewer: [
    'auctions:read', 'lots:read', 'users:read', 'audit:read', 'reports:read',
  ],
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes('*') || perms.includes(permission);
}
```

### 3.3 API Authentication Flow

```
┌─────────────┐   Magic Link / Password    ┌─────────────────┐
│  Client App  │ ─────────────────────────→ │  Auth.js (v5)   │
│  (Browser)   │ ←───────────────────────── │  /api/auth/...  │
│              │       JWT Cookie           │                 │
└──────┬───────┘                            └────────┬────────┘
       │                                             │
       │ Every request                               │ Verify + decode
       ▼                                             ▼
┌─────────────┐                            ┌─────────────────┐
│  Next.js     │  x-user-visibility: 1     │  PostgreSQL     │
│  Middleware   │  x-user-id: uuid          │  (users/admins) │
│              │  x-user-type: user         │                 │
└──────┬───────┘                            └─────────────────┘
       │
       ▼
┌─────────────┐
│  Route       │  WHERE visibility_level <= 1
│  Handler /   │  AND deleted_at IS NULL
│  Server Comp │
└─────────────┘
```

**Token payload** (JWT):
```json
{
  "sub": "uuid-of-user",
  "email": "user@example.com",
  "name": "Jan Kowalski",
  "userType": "user",           // "user" | "admin"
  "visibilityLevel": 1,         // 0, 1, or 2
  "role": null,                 // admin role, null for regular users
  "paddleNumbers": { "auc-uuid": 42 },  // active registrations
  "iat": 1709000000,
  "exp": 1709086400
}
```

### 3.4 Session Management

- **JWT-based sessions** (stateless, no DB lookup per request)
- **Token lifetime**: 24 hours, with sliding window refresh
- **Admin sessions**: Shorter lifetime (8 hours), require 2FA for super_admin/admin roles
- **Concurrent sessions**: Allowed (user can be logged in on multiple devices)
- **Session revocation**: For admin accounts, maintain a `revoked_sessions` table checked on sensitive operations (not every request — balance security vs performance)

---

## 4. API Endpoints

### 4.1 Public Endpoints (No Auth Required)

```
GET  /api/auctions                    — List auctions (filtered by caller's visibility)
GET  /api/auctions/:slug              — Single auction detail
GET  /api/auctions/:slug/lots         — Lots for auction (filtered by visibility)
GET  /api/lots/:id                    — Single lot detail
GET  /api/lots/:id/bids               — Bid history for lot (public, anonymized)
```

Query parameters for list endpoints:
- `status` — filter by auction/lot status
- `category` — filter by category
- `page`, `limit` — pagination (default: page=1, limit=20, max limit=100)
- `sort` — `sort_order` (default), `date`, `title`
- `q` — full-text search (lots: searches title, artist, description)

### 4.2 Authenticated Endpoints (User Auth Required)

```
POST /api/auth/register               — Create account (email magic link)
POST /api/auth/login                  — Login (email/password or magic link)
POST /api/auth/logout                 — Logout
GET  /api/auth/session                — Current session info

POST /api/auctions/:auctionId/register   — Register for auction (get paddle)
GET  /api/me/registrations               — User's auction registrations

POST /api/lots/:lotId/bids               — Place a bid
GET  /api/me/bids                        — User's bid history

POST /api/lots/:lotId/watch              — Add lot to watchlist
DELETE /api/lots/:lotId/watch            — Remove from watchlist
GET  /api/me/watchlist                   — User's watched lots

GET  /api/me/notifications               — User's notifications
POST /api/me/notifications/:id/read      — Mark notification as read

GET  /api/me/profile                     — User profile
PATCH /api/me/profile                    — Update profile (name, phone, address)
```

### 4.3 Admin Endpoints (`/api/admin/...`, Admin Auth Required)

```
# Auction Management
GET    /api/admin/auctions                  — List all auctions (incl. drafts)
POST   /api/admin/auctions                  — Create auction
GET    /api/admin/auctions/:id              — Get auction (full detail)
PATCH  /api/admin/auctions/:id              — Update auction
DELETE /api/admin/auctions/:id              — Soft-delete auction
PATCH  /api/admin/auctions/:id/status       — Change auction status
PATCH  /api/admin/auctions/:id/reorder      — Update sort order
POST   /api/admin/auctions/reorder          — Bulk reorder auctions

# Lot Management
GET    /api/admin/auctions/:auctionId/lots  — List lots for auction
POST   /api/admin/auctions/:auctionId/lots  — Create lot
GET    /api/admin/lots/:id                  — Get lot (full detail)
PATCH  /api/admin/lots/:id                  — Update lot
DELETE /api/admin/lots/:id                  — Soft-delete lot
PATCH  /api/admin/lots/:id/status           — Change lot status
POST   /api/admin/auctions/:auctionId/lots/reorder — Bulk reorder lots

# Media Management
POST   /api/admin/media/upload              — Upload image(s)
DELETE /api/admin/media/:id                 — Soft-delete media
PATCH  /api/admin/lots/:lotId/media/reorder — Reorder lot media
POST   /api/admin/lots/:lotId/media/youtube — Add YouTube URL

# Bid Management
GET    /api/admin/lots/:lotId/bids          — Full bid history (not anonymized)
POST   /api/admin/lots/:lotId/bids          — Enter bid (phone/floor)
POST   /api/admin/bids/:bidId/retract       — Retract bid (with reason)

# User/Client Management
GET    /api/admin/users                     — List users (with filters)
POST   /api/admin/users                     — Create user
GET    /api/admin/users/:id                 — Get user detail
PATCH  /api/admin/users/:id                 — Update user (incl. visibility, notes)
DELETE /api/admin/users/:id                 — Soft-delete user

# Bid Registrations
GET    /api/admin/auctions/:auctionId/registrations  — List registrations
PATCH  /api/admin/registrations/:id/approve           — Approve registration
PATCH  /api/admin/registrations/:id/reject            — Reject registration

# Admin Account Management (super_admin only)
GET    /api/admin/admins                    — List admins
POST   /api/admin/admins                    — Create admin
PATCH  /api/admin/admins/:id               — Update admin
DELETE /api/admin/admins/:id               — Soft-delete admin

# Audit & Reports
GET    /api/admin/audit-log                 — Query audit log
GET    /api/admin/reports/sales             — Sales summary by auction
GET    /api/admin/reports/users             — User activity summary

# Invoices (Phase 2)
GET    /api/admin/invoices                  — List invoices
POST   /api/admin/lots/:lotId/invoice       — Generate invoice for sold lot
PATCH  /api/admin/invoices/:id              — Update invoice status
```

### 4.4 Real-time (Phase 2)

```
WS  /api/ws/auction/:auctionId          — WebSocket for live bid updates
SSE /api/sse/auction/:auctionId          — Server-Sent Events fallback
```

### 4.5 Shared Patterns

**Pagination response format**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

**Error response format**:
```json
{
  "error": {
    "code": "INSUFFICIENT_VISIBILITY",
    "message": "This auction requires VIP access",
    "status": 403
  }
}
```

**Validation**: Use `zod` schemas shared between client and server. Each endpoint validates input with a zod schema before touching the database.

---

## 5. Admin Panel Design

### 5.1 Route Structure

```
/admin                           — Dashboard (overview stats)
/admin/login                     — Admin login page
/admin/auctions                  — Auction list
/admin/auctions/new              — Create auction
/admin/auctions/:id              — Edit auction
/admin/auctions/:id/lots         — Manage lots (drag-and-drop grid)
/admin/auctions/:id/lots/new     — Create lot
/admin/auctions/:id/lots/:lotId  — Edit lot (with media management)
/admin/auctions/:id/registrations — Manage paddle registrations
/admin/auctions/:id/bids         — Auction bid overview
/admin/users                     — User/client list
/admin/users/:id                 — User detail/edit
/admin/admins                    — Admin account management (super_admin only)
/admin/audit-log                 — Audit log viewer
/admin/reports                   — Reports dashboard
/admin/settings                  — System settings
```

### 5.2 Dashboard

The admin dashboard (`/admin`) shows:
- **Active auctions**: cards with status, lot count, registration count
- **Recent activity**: latest bid registrations, bids, user signups
- **Quick stats**: total users, active auctions, lots catalogued today
- **Alerts**: auctions nearing start date without all lots published, pending registrations needing approval

### 5.3 Auction Management Workflow

```
┌──────────────────────────────────────────────────────────────┐
│  Auction List View                                           │
│                                                              │
│  [+ New Auction]                                             │
│                                                              │
│  Drag to reorder:                                            │
│  ┌────┬──────────────────────────┬────────┬──────────┬────┐  │
│  │ ⠿  │ Title                    │ Status │ Vis.     │ ⋮  │  │
│  ├────┼──────────────────────────┼────────┼──────────┼────┤  │
│  │ ⠿  │ Współczesna Rzeźba...    │ 🟢 LIVE│ Public   │ ⋮  │  │
│  │ ⠿  │ Fotografia XX Wieku     │ 📋 DRAFT│ Private │ ⋮  │  │
│  │ ⠿  │ Kolekcja Przełomu...    │ 📋 DRAFT│ VIP     │ ⋮  │  │
│  └────┴──────────────────────────┴────────┴──────────┴────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Auction edit form fields**:
- Title, slug (auto-generated, editable)
- Description (rich text — Tiptap editor)
- Category (dropdown)
- Cover image (upload or select from media library)
- Start date, end date (datetime pickers)
- Location
- Curator
- Visibility level (0/1/2 radio buttons with labels)
- Buyer's premium rate
- Status (workflow buttons: Draft → Preview → Live → Reconciliation → Archive)
- Internal notes

**Status transitions** are explicit button actions with confirmation:
- "Publish Preview" — makes catalog visible to eligible users
- "Go Live" — opens bidding
- "Close Bidding" — enters reconciliation
- "Archive" — marks auction as historical

### 5.4 Lot Management (with drag-and-drop)

```
┌──────────────────────────────────────────────────────────────┐
│  Lots for "Współczesna Rzeźba Europejska"     [+ Add Lot]   │
│                                                              │
│  Drag to reorder:                                            │
│  ┌─────┬──────┬────────────────┬────────────┬────────┬────┐  │
│  │  ⠿  │ #    │ Image + Title  │ Artist     │ Status │ ⋮  │  │
│  ├─────┼──────┼────────────────┼────────────┼────────┼────┤  │
│  │  ⠿  │  1   │ 🖼 Pejzaż fan.│ Beksiński  │ Active │ ⋮  │  │
│  │  ⠿  │  2   │ 🖼 Abstrakcja │ Nowosiel.  │ Active │ ⋮  │  │
│  │  ⠿  │  3   │ 🖼 Postać...  │ Fangor     │ Draft  │ ⋮  │  │
│  └─────┴──────┴────────────────┴────────────┴────────┴────┘  │
│                                                              │
│  [Save Order]                                                │
└──────────────────────────────────────────────────────────────┘
```

**Lot edit form fields**:
- Lot number (auto-incrementing, overridable)
- Title, artist, year
- Medium, dimensions
- Description (rich text)
- Estimate min/max (PLN)
- Reserve price (optional, hidden from public)
- Starting bid (optional override)
- Provenance (dynamic list — add/remove/reorder entries)
- Exhibitions (dynamic list)
- Literature/bibliography (dynamic list)
- Condition notes
- Visibility override (inherit from auction / explicit 0/1/2)
- Status (workflow buttons)
- Internal notes

**Media management** (within lot edit):
```
┌──────────────────────────────────────────────────────────────┐
│  Images & Video                                              │
│                                                              │
│  Drag to reorder:                          [+ Upload] [+ YT]│
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  ★      │  │         │  │         │  │  ▶       │        │
│  │  img1   │  │  img2   │  │  img3   │  │  YouTube │        │
│  │         │  │         │  │         │  │          │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│  [Set Primary]   [Delete]    [Delete]    [Delete]           │
└──────────────────────────────────────────────────────────────┘
```

- Drag-and-drop image reordering
- Star icon on primary image (used as lot thumbnail)
- Upload via drag-drop or file picker
- YouTube URL paste (auto-generates thumbnail preview)
- Multi-file upload support

### 5.5 User/Client Management

```
┌──────────────────────────────────────────────────────────────┐
│  Users                           [+ New User] [Export CSV]   │
│                                                              │
│  Search: [________________]  Level: [All ▼]                  │
│                                                              │
│  ┌────────────────┬──────────┬──────────┬────────┬────────┐  │
│  │ Name           │ Email    │ Level    │ Ref.   │ Active │  │
│  ├────────────────┼──────────┼──────────┼────────┼────────┤  │
│  │ Jan Kowalski   │ jan@...  │ 🟢 VIP  │ —      │ ✓      │  │
│  │ Anna Nowak     │ anna@... │ 🔵 Priv │ Jan K. │ ✓      │  │
│  └────────────────┴──────────┴──────────┴────────┴────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**User detail view**:
- Editable: name, email, phone, address fields, visibility level, notes, referrer (searchable user picker)
- Read-only: registration date, last login, email verified status
- Related data tabs: "Bid History", "Auction Registrations", "Watchlist", "Invoices"
- Action buttons: "Reset Password", "Send Magic Link", "Deactivate"

### 5.6 Media Upload Workflow

1. Admin clicks "Upload" on lot media section
2. File picker opens (accepts `.jpg`, `.png`, `.webp`, max 20MB per file)
3. File is uploaded to `/api/admin/media/upload` via multipart form
4. Server:
   a. Validates file type and size
   b. Generates UUID filename
   c. Uses `sharp` to create 3 variants (400px, 800px, 1600px width)
   d. Uploads original + variants to S3/MinIO
   e. Creates `media` record in database
   f. Returns media record with all URLs
5. Frontend adds the new media card to the lot's media grid
6. Admin can reorder via drag-and-drop
7. "Save" persists the new `sort_order` values

For YouTube:
1. Admin clicks "Add YouTube Video"
2. Paste URL → system extracts video ID and validates
3. Creates `media` record with `media_type = 'youtube'`, stores full URL
4. Thumbnail auto-fetched from `https://img.youtube.com/vi/{id}/mqdefault.jpg`

---

## 6. Migration Strategy

### 6.1 Overview

The migration transforms Omenaa from a statically-exported site with data in TypeScript files to a database-backed application with ISR rendering. This must be done with **zero data loss** and **zero downtime**.

### 6.2 Step-by-Step Plan

#### Step 1: Add Database Infrastructure

1. Add PostgreSQL to `docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: omenaa
      POSTGRES_USER: omenaa
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: omenaa
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

volumes:
  pgdata:
  minio_data:
```

2. Install dependencies:
```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg
npm install next-auth@5 @auth/drizzle-adapter
npm install sharp zod @dnd-kit/core @dnd-kit/sortable
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

3. Create `drizzle.config.ts` and `db/` directory with schema from Section 2.

4. Run initial migration:
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

#### Step 2: Create Seed Script

Build a script (`scripts/seed-from-data.ts`) that:

1. **Reads** `app/lib/data.ts` — imports `auctions`, `lots`, `teamMembers`, `events`, `pressItems`, `stats`
2. **Inserts auctions** — maps current `Auction` fields to new schema:
   - `id: 'auc-1'` → keep as reference, generate new UUID
   - `status: 'ended'` → `status: 'archive'`
   - `status: 'live'` → `status: 'live'`
   - `status: 'upcoming'` → `status: 'preview'`
   - `visibilityLevel` → default `'0'` (public)
   - `sortOrder` → based on array index
3. **Inserts lots** — maps current `Lot` fields:
   - `auctionSlug` → resolve to `auctionId` UUID
   - `images[]` → create `media` records:
     - YouTube URLs → `media_type: 'youtube'`
     - Image paths → `media_type: 'image'`
   - `provenance[]` → stored as `jsonb`
   - `exhibited[]` → stored as `jsonb` in `exhibitions`
   - `currentBid` → if non-null, create a seed bid record
   - `lotNumber` → direct mapping
4. **Copies images** from `public/images/` to MinIO:
   - For each image, upload original and generate thumbnails
   - Update `media` records with S3 URLs
5. **Creates initial admin** account (super_admin)
6. **Prints** migration report: counts, any warnings

```bash
npx tsx scripts/seed-from-data.ts
```

#### Step 3: Create Database Access Layer

Replace static data imports with database queries:

```typescript
// db/queries/auctions.ts
import { db } from '../connection';
import { auctions, lots, media } from '../schema';
import { eq, and, asc } from 'drizzle-orm';
import { notDeleted, auctionVisibilityFilter } from '../helpers';

export async function getAuctions(userVisibility: number) {
  return db
    .select()
    .from(auctions)
    .where(auctionVisibilityFilter(userVisibility))
    .orderBy(asc(auctions.sortOrder));
}

export async function getAuctionBySlug(slug: string, userVisibility: number) {
  const [auction] = await db
    .select()
    .from(auctions)
    .where(and(
      eq(auctions.slug, slug),
      auctionVisibilityFilter(userVisibility),
    ))
    .limit(1);
  return auction ?? null;
}

export async function getLotsByAuction(auctionId: string, userVisibility: number) {
  return db
    .select()
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(
      eq(lots.auctionId, auctionId),
      notDeleted(lots),
      // lot visibility filtering...
    ))
    .orderBy(asc(lots.sortOrder));
}
```

#### Step 4: Switch from Static Export to ISR

1. **Remove** `output: "export"` from `next.config.ts`
2. **Remove** `images: { unoptimized: true }` — use Next.js Image Optimization
3. **Configure** ISR revalidation:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  basePath: "/omenaa",
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'localhost', port: '9000' },  // MinIO dev
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },       // S3 prod
    ],
  },
};
```

4. **Convert pages** from static to dynamic/ISR:

```typescript
// Before (static):
export function generateStaticParams() { ... }

// After (ISR):
export const revalidate = 60; // Re-check every 60 seconds

export default async function AuctionDetailPage({ params }) {
  const { slug } = await params;
  const auction = await getAuctionBySlug(slug, 0); // Will add auth later
  ...
}
```

5. **Remove** `generateStaticParams()` from all pages (or keep for popular paths as optimization hints)

#### Step 5: Parallel Running Period

1. **Deploy** new version alongside old static site
2. **Both read from** database (new) — old static export remains as fallback
3. **Verify**: all pages render correctly from database
4. **Switch DNS** / reverse proxy to new version
5. **Keep old static** export for 1 week as emergency rollback

#### Step 6: Enable Auth & Admin Panel

1. Configure Auth.js with Drizzle adapter
2. Deploy admin panel routes (`/admin/...`)
3. Create initial admin accounts
4. Test full CRUD workflow
5. Enable visibility filtering in production

### 6.3 Data Integrity Verification

After seeding, run verification:
- Count: same number of auctions, lots, images
- Spot-check: render 5 random lot pages via DB and compare with static
- Images: verify all thumbnails accessible via S3 URLs
- Bids: any seeded bids match original `currentBid` values

### 6.4 Rollback Plan

If anything goes wrong:
1. Revert `next.config.ts` to `output: "export"`
2. Rebuild static site
3. Database remains intact — no data lost
4. Fix issues, retry migration

---

## 7. Additional Features

### Recommended Beyond Client Requirements

#### Priority A — Should Include in Phase 1

1. **Auction soft-close mechanism** (already implemented client-side, move to server):
   Server-side soft-close timer prevents bid sniping. If a bid is placed within the last N minutes, the auction extends automatically. The current client-side implementation is insecure — must be server-authoritative.

2. **Bid increment validation**:
   The current bid increment table (`bidding.ts`) must be enforced server-side. Reject bids that don't meet the minimum increment.

3. **Rate limiting**:
   - Bid placement: max 1 bid per 2 seconds per user per lot
   - Login attempts: max 5 per 15 minutes per IP
   - API: 100 requests/minute for public endpoints, 1000/minute for authenticated

4. **Image optimization pipeline**:
   Auto-generate WebP/AVIF variants for faster loading. Current `.jpg` images are unoptimized.

5. **Search**:
   Full-text search across lots (title, artist, description, provenance) using PostgreSQL `tsvector` with Polish dictionary.

#### Priority B — Phase 2 Candidates

6. **Real-time bid updates** via WebSocket/SSE:
   Replace client-side polling/simulated bids with server-pushed updates. Essential for a credible live auction experience.

7. **Email notifications**:
   - Outbid alerts
   - Auction starting/ending reminders
   - Registration approval
   - Winner congratulations
   - Invoice/payment reminders

8. **Absentee bidding** (proxy bids):
   User sets a maximum amount. System automatically bids on their behalf up to that amount, at the minimum increment. Standard in the auction industry.

9. **Consignor management**:
   Track who consigned each lot. Not in initial requirements but standard for auction houses. Add `consignor_id` FK to lots table (references users or a separate consignors table).

10. **Condition report PDFs**:
    Generate downloadable condition reports for lots. Useful for high-value items.

#### Priority C — Phase 3 (Future Roadmap)

11. **Multi-language content** (not just UI labels):
    Currently i18n covers UI strings only. For international reach, lot descriptions should be translatable. Add `lot_translations` table with `locale` + `title` + `description` columns.

12. **Analytics dashboard**:
    - Sell-through rate per auction
    - Average hammer-to-estimate ratio
    - User activity heatmaps
    - Revenue trends

13. **Payment integration**:
    Stripe/Przelewy24 for online payments. Invoice generation with PDF export.

14. **Buyer's premium tiers**:
    Sliding scale premium (e.g., 25% on first 100k, 20% on 100k-500k, 12% above 500k).

15. **API for third-party lot aggregators**:
    Read-only API for platforms like Invaluable, Artnet, or Barnebys to list Omenaa lots.

---

## 8. Implementation Phases

### Phase 1: Core (Must Have for Launch)

**Estimated scope**: Foundation + basic CMS + public-facing data from DB

| #  | Task                                         | Dependencies |
|----|----------------------------------------------|-------------|
| 1  | Set up PostgreSQL + Drizzle + migrations     | —           |
| 2  | Set up MinIO/S3 + image upload pipeline      | —           |
| 3  | Implement database schema (all tables)       | 1           |
| 4  | Write seed script (data.ts → database)       | 1, 2, 3     |
| 5  | Database query layer (replace data imports)  | 3           |
| 6  | Switch from static export to ISR             | 5           |
| 7  | Auth.js setup (admin + client auth)          | 3           |
| 8  | Visibility middleware + per-query filtering  | 7           |
| 9  | Admin: login, dashboard                      | 7           |
| 10 | Admin: auction CRUD + status workflow        | 9           |
| 11 | Admin: lot CRUD + media management           | 9, 2        |
| 12 | Admin: lot drag-and-drop ordering            | 11          |
| 13 | Admin: user/client management                | 9           |
| 14 | Server-side bid validation + placement       | 5, 7        |
| 15 | Audit log (application-level + DB triggers)  | 3           |
| 16 | Rate limiting                                | 7           |
| 17 | Full-text search (lots)                      | 5           |

**Deliverable**: Fully functional CMS with admin panel, database-backed public site, auth, visibility control, and bidding.

### Phase 2: Enhanced (Nice to Have, Soon After Launch)

| #  | Task                                         | Dependencies   |
|----|----------------------------------------------|---------------|
| 18 | Real-time bid updates (WebSocket/SSE)        | Phase 1       |
| 19 | Email notification system                    | Phase 1       |
| 20 | Absentee bidding (proxy bids)                | 14, 18        |
| 21 | Bid registration approval workflow           | 10, 13        |
| 22 | Invoice generation                           | 14            |
| 23 | Admin: bid management (enter phone/floor)    | 14            |
| 24 | Admin: audit log viewer                      | 15            |
| 25 | Admin: reports dashboard                     | Phase 1       |
| 26 | 2FA (TOTP) for admin accounts                | 7             |
| 27 | Admin account management (sub-admins)        | 9             |

**Deliverable**: Professional auction house workflow with real-time bidding, notifications, invoicing, and full admin tools.

### Phase 3: Advanced (Future Roadmap)

| #  | Task                                         | Dependencies   |
|----|----------------------------------------------|---------------|
| 28 | Multi-language content (lot translations)    | Phase 2       |
| 29 | Consignor management                         | Phase 2       |
| 30 | Payment integration (Stripe/Przelewy24)      | 22            |
| 31 | Analytics dashboard                          | 25            |
| 32 | Condition report PDF generation              | 11            |
| 33 | Buyer's premium tiers (sliding scale)        | 22            |
| 34 | Third-party API (Invaluable, Artnet)         | Phase 2       |
| 35 | Mobile-optimized admin panel                 | Phase 2       |
| 36 | Bulk lot import (CSV/Excel)                  | 11            |

**Deliverable**: Enterprise-grade auction platform with financial management, analytics, and third-party integrations.

---

## Appendix A: Updated Docker Compose

```yaml
# docker-compose.yml (development)
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3002:3002"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    environment:
      - WATCHPACK_POLLING=true
      - DATABASE_URL=postgresql://omenaa:omenaa_dev@db:5432/omenaa
      - MINIO_ENDPOINT=http://minio:9000
      - MINIO_ACCESS_KEY=omenaa
      - MINIO_SECRET_KEY=omenaa_dev
      - NEXTAUTH_SECRET=dev-secret-change-in-production
      - NEXTAUTH_URL=http://localhost:3002/omenaa
    depends_on:
      - db
      - minio

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: omenaa
      POSTGRES_USER: omenaa
      POSTGRES_PASSWORD: omenaa_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: omenaa
      MINIO_ROOT_PASSWORD: omenaa_dev
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

volumes:
  pgdata:
  minio_data:
```

## Appendix B: Key Dependencies to Add

```json
{
  "dependencies": {
    "drizzle-orm": "^0.38",
    "pg": "^8.13",
    "@aws-sdk/client-s3": "^3.700",
    "@aws-sdk/s3-request-presigner": "^3.700",
    "next-auth": "^5.0.0-beta",
    "@auth/drizzle-adapter": "^1.7",
    "sharp": "^0.33",
    "zod": "^3.24",
    "@dnd-kit/core": "^6.3",
    "@dnd-kit/sortable": "^10.0",
    "bcryptjs": "^2.4",
    "otplib": "^12.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30",
    "@types/pg": "^8.11",
    "@types/bcryptjs": "^2.4"
  }
}
```

## Appendix C: Environment Variables

```bash
# .env.local (development)
DATABASE_URL=postgresql://omenaa:omenaa_dev@localhost:5432/omenaa

# MinIO / S3
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=omenaa
MINIO_SECRET_KEY=omenaa_dev
S3_BUCKET=omenaa-media
S3_PUBLIC_URL=http://localhost:9000/omenaa-media

# Auth
NEXTAUTH_SECRET=dev-secret-32-chars-minimum-here
NEXTAUTH_URL=http://localhost:3002/omenaa

# Email (Phase 2)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@omenaa.pl
```

## Appendix D: File Structure (New Additions)

```
omenaa/
├── app/
│   ├── admin/                    # Admin panel (new)
│   │   ├── layout.tsx            # Admin layout with sidebar
│   │   ├── page.tsx              # Dashboard
│   │   ├── login/page.tsx
│   │   ├── auctions/
│   │   │   ├── page.tsx          # List
│   │   │   ├── new/page.tsx      # Create
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Edit
│   │   │       ├── lots/
│   │   │       │   ├── page.tsx  # Lot management
│   │   │       │   ├── new/page.tsx
│   │   │       │   └── [lotId]/page.tsx
│   │   │       └── registrations/page.tsx
│   │   ├── users/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── admins/page.tsx       # super_admin only
│   │   ├── audit-log/page.tsx
│   │   └── reports/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── auctions/route.ts
│   │   ├── auctions/[slug]/route.ts
│   │   ├── auctions/[slug]/lots/route.ts
│   │   ├── lots/[id]/route.ts
│   │   ├── lots/[id]/bids/route.ts
│   │   ├── me/
│   │   │   ├── bids/route.ts
│   │   │   ├── watchlist/route.ts
│   │   │   └── notifications/route.ts
│   │   └── admin/                # Admin API routes
│   │       ├── auctions/route.ts
│   │       ├── lots/route.ts
│   │       ├── media/upload/route.ts
│   │       ├── users/route.ts
│   │       └── ...
│   └── ...                       # Existing pages (modified)
├── db/
│   ├── schema.ts                 # Drizzle schema (Section 2)
│   ├── connection.ts             # Database connection pool
│   ├── helpers.ts                # notDeleted(), visibility filters
│   ├── queries/                  # Organized query functions
│   │   ├── auctions.ts
│   │   ├── lots.ts
│   │   ├── bids.ts
│   │   ├── users.ts
│   │   └── media.ts
│   └── migrations/               # Generated by drizzle-kit
├── lib/
│   ├── auth.ts                   # Auth.js configuration
│   ├── permissions.ts            # Role-permission matrix
│   ├── validation/               # Zod schemas
│   │   ├── auction.ts
│   │   ├── lot.ts
│   │   ├── bid.ts
│   │   └── user.ts
│   └── s3.ts                     # S3/MinIO client
├── scripts/
│   ├── seed-from-data.ts         # Migration seed script
│   └── create-admin.ts           # Create initial admin
├── drizzle.config.ts
├── middleware.ts                  # Auth + visibility middleware
└── .env.local
```
