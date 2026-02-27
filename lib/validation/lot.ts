import { z } from 'zod';

export const lotStatusValues = [
  'draft', 'catalogued', 'published', 'active', 'sold', 'passed', 'withdrawn',
] as const;

export const createLotSchema = z.object({
  auctionId: z.string().uuid(),
  lotNumber: z.number().int().positive(),
  title: z.string().min(1, 'Title is required').max(500),
  artist: z.string().default(''),
  description: z.string().default(''),
  medium: z.string().default(''),
  dimensions: z.string().default(''),
  year: z.number().int().nullable().optional(),
  estimateMin: z.number().int().min(0).default(0),
  estimateMax: z.number().int().min(0).default(0),
  reservePrice: z.number().int().min(0).nullable().optional(),
  startingBid: z.number().int().min(0).nullable().optional(),
  visibilityOverride: z.enum(['0', '1', '2']).nullable().optional(),
  provenance: z.array(z.string()).default([]),
  exhibitions: z.array(z.string()).default([]),
  literature: z.array(z.string()).default([]),
  conditionNotes: z.string().default(''),
  notes: z.string().default(''),
  consignorId: z.string().uuid().nullable().optional(),
});

export const updateLotSchema = createLotSchema.partial().omit({ auctionId: true });

export const updateLotStatusSchema = z.object({
  status: z.enum(lotStatusValues),
});

export const reorderLotsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
