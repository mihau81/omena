import { z } from 'zod';

export const createAdminSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1, 'Name is required').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  role: z.enum(['super_admin', 'admin', 'cataloguer', 'auctioneer', 'viewer']).default('viewer'),
});

export const updateAdminSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(['super_admin', 'admin', 'cataloguer', 'auctioneer', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
