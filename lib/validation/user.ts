import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().max(30).default(''),
  address: z.string().default(''),
  city: z.string().max(100).default(''),
  postalCode: z.string().max(20).default(''),
  country: z.string().max(100).default('Poland'),
  visibilityLevel: z.enum(['0', '1', '2']).default('0'),
  notes: z.string().default(''),
});

export const updateUserSchema = createUserSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const updateUserVisibilitySchema = z.object({
  visibilityLevel: z.enum(['0', '1', '2']),
});

export const registerUserSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  phone: z.string().max(30).optional(),
  referrerId: z.string().uuid().optional(),  // Optional referrer user ID from ?ref= param
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

export const magicLinkRequestSchema = z.object({
  email: z.string().email().max(320),
  locale: z.string().max(5).default('pl'),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email().max(320),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerQrSchema = registerUserSchema.extend({
  qrCode: z.string().min(1, 'QR code is required'),
});

export const registerInvitationSchema = registerUserSchema.extend({
  invitationToken: z.string().min(1, 'Invitation token is required'),
});

export const sendInvitationSchema = z.object({
  email: z.string().email().max(320),
});

export const rejectUserSchema = z.object({
  reason: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
