import { sqliteTable, text, real, integer, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table schema
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).default('user').notNull(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
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
  date: integer('date', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['pending', 'confirmed', 'cancelled'] }).default('pending').notNull(),
  paymentStatus: text('payment_status', { enum: ['pending', 'completed', 'failed'] }).default('pending').notNull(),
  paymentId: text('payment_id'),
  meetLink: text('meet_link'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;