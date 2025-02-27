import { sqliteTable, text, real, integer, blob } from 'drizzle-orm/sqlite-core';

// Users table schema
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP')
});

// Payments table schema
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().unique(),
  paymentSessionId: text('payment_session_id').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('PENDING'),
  paymentMethod: text('payment_method'),
  paymentTime: text('payment_time'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP')
});

// Bookings table schema
export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  orderId: text('order_id').notNull().unique().references(() => payments.orderId),
  consultationDate: text('consultation_date').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phoneNumber: text('phone_number').notNull(),
  files: blob('files'),
  amount: real('amount').notNull(),
  isGuest: integer('is_guest', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('PENDING'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP')
});

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;