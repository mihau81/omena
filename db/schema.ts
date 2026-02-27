import {
  pgTable, pgEnum,
  uuid, text, varchar, integer, boolean, timestamp, numeric,
  jsonb, serial, index, uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';

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

// ─── Consignors ──────────────────────────────────────────────────────────────

export const consignors = pgTable('consignors', {
  id:             uuid('id').defaultRandom().primaryKey(),
  name:           text('name').notNull(),
  email:          varchar('email', { length: 320 }),
  phone:          varchar('phone', { length: 30 }).default(''),
  address:        text('address').default(''),
  city:           varchar('city', { length: 100 }).default(''),
  postalCode:     varchar('postal_code', { length: 20 }).default(''),
  country:        varchar('country', { length: 100 }).default('Poland'),
  companyName:    text('company_name').default(''),
  taxId:          varchar('tax_id', { length: 30 }).default(''),  // NIP
  commissionRate: numeric('commission_rate', { precision: 5, scale: 4 }).default('0.1000'),  // 10% default
  notes:          text('notes').default(''),
  isActive:       boolean('is_active').notNull().default(true),
  // Soft delete & audit
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:      timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('consignors_name_idx').on(table.name),
  index('consignors_email_idx').on(table.email),
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
  consignorId:      uuid('consignor_id').references(() => consignors.id),
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

// ─── Lot Translations (multi-language content) ──────────────────────────────

export const lotTranslations = pgTable('lot_translations', {
  id:             uuid('id').defaultRandom().primaryKey(),
  lotId:          uuid('lot_id').notNull().references(() => lots.id),
  locale:         varchar('locale', { length: 5 }).notNull(), // 'pl', 'en', 'de', 'fr', 'uk'
  title:          text('title').notNull(),
  description:    text('description').notNull().default(''),
  medium:         text('medium').notNull().default(''),
  provenance:     jsonb('provenance').notNull().default('[]'),
  exhibitions:    jsonb('exhibitions').notNull().default('[]'),
  conditionNotes: text('condition_notes').default(''),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('lot_translations_lot_locale_idx').on(table.lotId, table.locale),
  index('lot_translations_locale_idx').on(table.locale),
]);

// ─── Premium Tiers (sliding-scale buyer's premium) ──────────────────────────

export const premiumTiers = pgTable('premium_tiers', {
  id:          uuid('id').defaultRandom().primaryKey(),
  auctionId:   uuid('auction_id').notNull().references(() => auctions.id),
  minAmount:   integer('min_amount').notNull(),   // PLN, inclusive
  maxAmount:   integer('max_amount'),             // PLN, exclusive (null = unlimited)
  rate:        numeric('rate', { precision: 5, scale: 4 }).notNull(), // e.g. 0.2500 = 25%
  sortOrder:   integer('sort_order').notNull().default(0),
}, (table) => [
  index('premium_tiers_auction_idx').on(table.auctionId),
]);

// ─── API Keys (Third-party integrations: Invaluable, Artnet, Barnebys) ──────

export const apiKeys = pgTable('api_keys', {
  id:          uuid('id').defaultRandom().primaryKey(),
  name:        varchar('name', { length: 100 }).notNull(), // e.g., "Invaluable", "Artnet"
  keyHash:     text('key_hash').notNull(),                 // bcrypt hash of the API key
  keyPrefix:   varchar('key_prefix', { length: 10 }).notNull(), // first 8 chars for identification
  permissions: jsonb('permissions').notNull().default('["lots:read","auctions:read"]'),
  rateLimit:   integer('rate_limit').notNull().default(1000), // requests per hour
  isActive:    boolean('is_active').notNull().default(true),
  lastUsedAt:  timestamp('last_used_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt:   timestamp('expires_at', { withTimezone: true }),
}, (table) => [
  index('api_keys_prefix_idx').on(table.keyPrefix),
  index('api_keys_active_idx').on(table.isActive),
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

// ─── Payments ────────────────────────────────────────────────────────────────

export const payments = pgTable('payments', {
  id:           uuid('id').defaultRandom().primaryKey(),
  invoiceId:    uuid('invoice_id').notNull().references(() => invoices.id),
  provider:     varchar('provider', { length: 20 }).notNull(), // 'stripe', 'przelewy24', 'transfer'
  externalId:   varchar('external_id', { length: 255 }),       // Stripe payment intent ID
  amount:       integer('amount').notNull(),                    // in smallest unit (grosze for PLN)
  currency:     varchar('currency', { length: 3 }).notNull().default('PLN'),
  status:       varchar('status', { length: 20 }).notNull().default('pending'),
  // Status: 'pending', 'processing', 'succeeded', 'failed', 'refunded'
  metadata:     jsonb('metadata').default('{}'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('payments_invoice_idx').on(table.invoiceId),
  index('payments_external_id_idx').on(table.externalId),
  index('payments_status_idx').on(table.status),
]);
