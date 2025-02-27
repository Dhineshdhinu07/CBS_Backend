import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { bookingSchema, updateBookingSchema } from '../schemas';
import { authMiddleware, AuthUser } from '../middleware/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { bookings } from '../db/schema';
import { createDbClient } from '../db';
import { nanoid } from 'nanoid';

interface Env {
  DB: D1Database;
}

interface Variables {
  user: AuthUser;
}

const bookingsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes
bookingsRouter.use('*', authMiddleware);

// Create a booking
bookingsRouter.post('/', zValidator('json', bookingSchema), async (c) => {
  const user = c.get('user');
  const { date } = c.req.valid('json');
  const db = createDbClient(c.env.DB);

  // TODO: Implement Cashfree payment integration
  // TODO: Generate Zoho Meet link

  const booking = await db.insert(bookings).values({
    id: nanoid(),
    userId: user.id,
    date,
    status: 'pending',
    paymentStatus: 'pending',
  }).returning();

  return c.json({
    success: true,
    booking: booking[0]
  });
});

// Get user's bookings with pagination
bookingsRouter.get('/my', async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);
  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '10');
  const offset = (page - 1) * limit;

  const [bookingsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(eq(bookings.userId, user.id));

  const userBookings = await db.query.bookings.findMany({
    where: eq(bookings.userId, user.id),
    orderBy: desc(bookings.createdAt),
    limit,
    offset,
  });

  return c.json({
    success: true,
    bookings: userBookings,
    pagination: {
      total: bookingsCount.count,
      page,
      limit,
      pages: Math.ceil(bookingsCount.count / limit)
    }
  });
});

// Update a booking
bookingsRouter.patch('/:id', zValidator('json', updateBookingSchema), async (c) => {
  const user = c.get('user');
  const bookingId = c.req.param('id');
  const updates = c.req.valid('json');
  const db = createDbClient(c.env.DB);

  const [existingBooking] = await db.query.bookings.findMany({
    where: and(
      eq(bookings.id, bookingId),
      eq(bookings.userId, user.id)
    )
  });

  if (!existingBooking) {
    throw new HTTPException(404, { message: 'Booking not found' });
  }

  const updateData = {
    ...(updates.status && { status: updates.status }),
    ...(updates.paymentStatus && { paymentStatus: updates.paymentStatus }),
    ...(updates.date && { date: updates.date }),
    updatedAt: sql`CURRENT_TIMESTAMP`
  };

  const [updatedBooking] = await db
    .update(bookings)
    .set(updateData)
    .where(eq(bookings.id, bookingId))
    .returning();

  return c.json({
    success: true,
    booking: updatedBooking
  });
});

// Delete a booking
bookingsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const bookingId = c.req.param('id');
  const db = createDbClient(c.env.DB);

  const [existingBooking] = await db.query.bookings.findMany({
    where: and(
      eq(bookings.id, bookingId),
      eq(bookings.userId, user.id)
    )
  });

  if (!existingBooking) {
    throw new HTTPException(404, { message: 'Booking not found' });
  }

  await db.delete(bookings).where(eq(bookings.id, bookingId));

  return c.json({
    success: true,
    message: 'Booking deleted successfully'
  });
});

export default bookingsRouter; 