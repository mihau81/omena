import { z } from 'zod';

export const createConsignorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  email: z.string().email('Invalid email').max(320).nullable().optional(),
  phone: z.string().max(30).default(''),
  address: z.string().default(''),
  city: z.string().max(100).default(''),
  postalCode: z.string().max(20).default(''),
  country: z.string().max(100).default('Poland'),
  companyName: z.string().default(''),
  taxId: z.string().max(30).default(''),
  commissionRate: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Invalid commission rate')
    .default('0.1000'),
  notes: z.string().default(''),
  isActive: z.boolean().default(true),
});

export const updateConsignorSchema = createConsignorSchema.partial();

export type CreateConsignorInput = z.infer<typeof createConsignorSchema>;
export type UpdateConsignorInput = z.infer<typeof updateConsignorSchema>;
