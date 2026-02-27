import { z } from 'zod';

export const bidTypeValues = [
  'online', 'phone', 'floor', 'absentee', 'system',
] as const;

export const placeBidSchema = z.object({
  lotId: z.string().uuid(),
  amount: z.number().int().positive('Bid amount must be positive'),
});

export const adminPlaceBidSchema = z.object({
  lotId: z.string().uuid(),
  amount: z.number().int().positive(),
  bidType: z.enum(['phone', 'floor']),
  paddleNumber: z.number().int().positive().optional(),
});

export const retractBidSchema = z.object({
  reason: z.string().min(1, 'Retraction reason is required'),
});

export const createAbsenteeBidSchema = z.object({
  lotId: z.string().uuid(),
  maxAmount: z.number().int().positive('Max amount must be positive'),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
export type AdminPlaceBidInput = z.infer<typeof adminPlaceBidSchema>;
export type RetractBidInput = z.infer<typeof retractBidSchema>;
