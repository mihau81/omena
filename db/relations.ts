import { relations } from 'drizzle-orm';
import {
  auctions, lots, media, users, admins,
  bidRegistrations, bids, bidRetractions, absenteeBids,
  watchedLots, notifications, invoices, sessions, lotTranslations,
  premiumTiers, consignors, payments,
} from './schema';

// ─── Auction Relations ───────────────────────────────────────────────────────

export const auctionsRelations = relations(auctions, ({ many }) => ({
  lots: many(lots),
  media: many(media),
  bidRegistrations: many(bidRegistrations),
  invoices: many(invoices),
  premiumTiers: many(premiumTiers),
}));

// ─── Premium Tier Relations ──────────────────────────────────────────────────

export const premiumTiersRelations = relations(premiumTiers, ({ one }) => ({
  auction: one(auctions, {
    fields: [premiumTiers.auctionId],
    references: [auctions.id],
  }),
}));

// ─── Lot Relations ───────────────────────────────────────────────────────────

export const lotsRelations = relations(lots, ({ one, many }) => ({
  auction: one(auctions, {
    fields: [lots.auctionId],
    references: [auctions.id],
  }),
  consignor: one(consignors, {
    fields: [lots.consignorId],
    references: [consignors.id],
  }),
  media: many(media),
  bids: many(bids),
  absenteeBids: many(absenteeBids),
  watchedLots: many(watchedLots),
  invoices: many(invoices),
  translations: many(lotTranslations),
}));

// ─── Lot Translation Relations ───────────────────────────────────────────────

export const lotTranslationsRelations = relations(lotTranslations, ({ one }) => ({
  lot: one(lots, {
    fields: [lotTranslations.lotId],
    references: [lots.id],
  }),
}));

// ─── Media Relations ─────────────────────────────────────────────────────────

export const mediaRelations = relations(media, ({ one }) => ({
  lot: one(lots, {
    fields: [media.lotId],
    references: [lots.id],
  }),
  auction: one(auctions, {
    fields: [media.auctionId],
    references: [auctions.id],
  }),
}));

// ─── User Relations ──────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  referrer: one(users, {
    fields: [users.referrerId],
    references: [users.id],
  }),
  bidRegistrations: many(bidRegistrations),
  bids: many(bids),
  absenteeBids: many(absenteeBids),
  watchedLots: many(watchedLots),
  notifications: many(notifications),
  invoices: many(invoices),
}));

// ─── Admin Relations ─────────────────────────────────────────────────────────

export const adminsRelations = relations(admins, ({ many }) => ({
  bidRetractions: many(bidRetractions),
  approvedRegistrations: many(bidRegistrations),
}));

// ─── Bid Registration Relations ──────────────────────────────────────────────

export const bidRegistrationsRelations = relations(bidRegistrations, ({ one, many }) => ({
  user: one(users, {
    fields: [bidRegistrations.userId],
    references: [users.id],
  }),
  auction: one(auctions, {
    fields: [bidRegistrations.auctionId],
    references: [auctions.id],
  }),
  approvedByAdmin: one(admins, {
    fields: [bidRegistrations.approvedBy],
    references: [admins.id],
  }),
  bids: many(bids),
}));

// ─── Bid Relations ───────────────────────────────────────────────────────────

export const bidsRelations = relations(bids, ({ one }) => ({
  lot: one(lots, {
    fields: [bids.lotId],
    references: [lots.id],
  }),
  user: one(users, {
    fields: [bids.userId],
    references: [users.id],
  }),
  registration: one(bidRegistrations, {
    fields: [bids.registrationId],
    references: [bidRegistrations.id],
  }),
  retraction: one(bidRetractions),
}));

// ─── Bid Retraction Relations ────────────────────────────────────────────────

export const bidRetractionsRelations = relations(bidRetractions, ({ one }) => ({
  bid: one(bids, {
    fields: [bidRetractions.bidId],
    references: [bids.id],
  }),
  retractedByAdmin: one(admins, {
    fields: [bidRetractions.retractedBy],
    references: [admins.id],
  }),
}));

// ─── Absentee Bid Relations ─────────────────────────────────────────────────

export const absenteeBidsRelations = relations(absenteeBids, ({ one }) => ({
  lot: one(lots, {
    fields: [absenteeBids.lotId],
    references: [lots.id],
  }),
  user: one(users, {
    fields: [absenteeBids.userId],
    references: [users.id],
  }),
}));

// ─── Watched Lot Relations ───────────────────────────────────────────────────

export const watchedLotsRelations = relations(watchedLots, ({ one }) => ({
  user: one(users, {
    fields: [watchedLots.userId],
    references: [users.id],
  }),
  lot: one(lots, {
    fields: [watchedLots.lotId],
    references: [lots.id],
  }),
}));

// ─── Notification Relations ──────────────────────────────────────────────────

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// ─── Invoice Relations ───────────────────────────────────────────────────────

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  auction: one(auctions, {
    fields: [invoices.auctionId],
    references: [auctions.id],
  }),
  lot: one(lots, {
    fields: [invoices.lotId],
    references: [lots.id],
  }),
  payments: many(payments),
}));

// ─── Payment Relations ───────────────────────────────────────────────────────

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

// ─── Consignor Relations ─────────────────────────────────────────────────────

export const consignorsRelations = relations(consignors, ({ many }) => ({
  lots: many(lots),
}));

// ─── Session Relations ───────────────────────────────────────────────────────
// Sessions reference users OR admins polymorphically via userType field.
// No Drizzle relation defined since it's polymorphic — use manual queries.
