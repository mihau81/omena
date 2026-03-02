/**
 * Seed default settings into the settings table.
 * Usage: npx tsx db/seed-settings.ts
 */

import { db } from './connection';
import { settings } from './schema';

const DEFAULT_SETTINGS = [
  // ─── Company ──────────────────────────────────────────────────────────────
  {
    key: 'company_name',
    value: 'Omena Auctions',
    category: 'company',
    label: 'Company Name',
    description: 'The official name of the auction house.',
  },
  {
    key: 'company_address',
    value: '',
    category: 'company',
    label: 'Street Address',
    description: 'Street address of the auction house.',
  },
  {
    key: 'company_city',
    value: '',
    category: 'company',
    label: 'City',
    description: 'City where the auction house is located.',
  },
  {
    key: 'company_postal_code',
    value: '',
    category: 'company',
    label: 'Postal Code',
    description: 'Postal code (e.g. 00-001).',
  },
  {
    key: 'company_country',
    value: 'Poland',
    category: 'company',
    label: 'Country',
    description: 'Country of the auction house.',
  },
  {
    key: 'company_nip',
    value: '',
    category: 'company',
    label: 'NIP (Tax ID)',
    description: 'Polish tax identification number.',
  },
  {
    key: 'company_phone',
    value: '',
    category: 'company',
    label: 'Phone Number',
    description: 'Main contact phone number.',
  },
  {
    key: 'company_email',
    value: '',
    category: 'company',
    label: 'Contact Email',
    description: 'Main contact email address.',
  },
  {
    key: 'company_website',
    value: '',
    category: 'company',
    label: 'Website',
    description: 'Auction house website URL.',
  },
  {
    key: 'company_bank_account',
    value: '',
    category: 'company',
    label: 'Bank Account Number',
    description: 'IBAN or bank account number shown on invoices (e.g. PL 00 0000 0000 0000 0000 0000 0000).',
  },

  // ─── Auction Defaults ────────────────────────────────────────────────────
  {
    key: 'default_buyer_premium_rate',
    value: '0.20',
    category: 'auction',
    label: "Default Buyer's Premium Rate",
    description: "Default buyer's premium as a decimal (e.g. 0.20 = 20%). Can be overridden per auction.",
  },
  {
    key: 'default_currency',
    value: 'PLN',
    category: 'auction',
    label: 'Default Currency',
    description: 'Default currency for auctions (e.g. PLN, EUR, USD).',
  },
  {
    key: 'default_visibility_level',
    value: '0',
    category: 'auction',
    label: 'Default Visibility Level',
    description: 'Default visibility for new auctions: 0 = Public, 1 = Private, 2 = VIP.',
  },

  // ─── Email ───────────────────────────────────────────────────────────────
  {
    key: 'smtp_configured',
    value: 'false',
    category: 'email',
    label: 'SMTP Configured',
    description: 'Read-only. Indicates whether SMTP is configured via environment variables.',
  },
  {
    key: 'email_from_name',
    value: 'Omena Auctions',
    category: 'email',
    label: 'From Name',
    description: 'The display name used when sending emails.',
  },
  {
    key: 'email_from_address',
    value: '',
    category: 'email',
    label: 'From Address',
    description: 'The email address used as the sender.',
  },
];

async function seedSettings() {
  console.log('Seeding default settings...\n');

  for (const setting of DEFAULT_SETTINGS) {
    await db
      .insert(settings)
      .values(setting)
      .onConflictDoNothing({ target: settings.key });
    console.log(`  [${setting.category}] ${setting.key}`);
  }

  console.log(`\nDone. ${DEFAULT_SETTINGS.length} settings seeded.`);
  process.exit(0);
}

seedSettings().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
