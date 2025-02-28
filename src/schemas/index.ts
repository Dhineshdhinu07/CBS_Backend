import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  phoneNumber: z.string().optional(),
});

export const bookingSchema = z.object({
  date: z.coerce.date()
    .refine((date) => {
      const now = new Date();
      return date.getTime() > now.getTime();
    }, { message: "Booking date must be in the future" })
});

export const updateBookingSchema = z.object({
  date: z.coerce.date()
    .refine((date) => {
      const now = new Date();
      return date.getTime() > now.getTime();
    }, { message: "Booking date must be in the future" })
    .optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'completed', 'failed']).optional(),
});

// Export types for use in routes
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>; 