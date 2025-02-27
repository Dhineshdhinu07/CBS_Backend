import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const bookingSchema = z.object({
  date: z.string()
    .datetime()
    .transform((date) => new Date(date)),
  // Additional booking fields can be added here
});

export const updateBookingSchema = z.object({
  date: z.string()
    .datetime()
    .transform((date) => new Date(date))
    .optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'completed', 'failed']).optional(),
});

// Export types for use in routes
export type LoginInput = z.infer<typeof loginSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>; 