import { z } from 'zod';

export const auctionStatusValues = [
  'draft', 'preview', 'live', 'reconciliation', 'archive',
] as const;

export const visibilityLevelValues = ['0', '1', '2'] as const;

const auctionBaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().default(''),
  category: z.string().max(50).default('mixed'),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  location: z.string().default(''),
  curator: z.string().default(''),
  visibilityLevel: z.enum(visibilityLevelValues).default('0'),
  buyersPremiumRate: z.string().regex(/^\d+\.\d{4}$/).default('0.2000'),
  notes: z.string().default(''),
  livestreamUrl: z.string().url().optional().or(z.literal('')).nullable(),
});

export const createAuctionSchema = auctionBaseSchema.refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'End date must be after start date', path: ['endDate'] },
);

export const updateAuctionSchema = auctionBaseSchema.partial().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  { message: 'End date must be after start date', path: ['endDate'] },
);

export const updateAuctionStatusSchema = z.object({
  status: z.enum(auctionStatusValues),
});

export const reorderAuctionsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })),
});

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
export type UpdateAuctionInput = z.infer<typeof updateAuctionSchema>;
