import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { updateBookingSchema } from '../schemas';
import { authMiddleware, adminMiddleware, AuthUser } from '../middleware/auth';
import { eq, desc, sql, like } from 'drizzle-orm';
import { bookings, users } from '../db/schema';
import { createDbClient } from '../db';

interface Env {
  DB: D1Database;
}

interface Variables {
  user: AuthUser;
}

const adminRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth and admin middleware to all routes
adminRouter.use('*', authMiddleware, adminMiddleware);

// Get all bookings with search, filter, and pagination
adminRouter.get('/bookings', async (c) => {
  const db = createDbClient(c.env.DB);
  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '10');
  const search = c.req.query('search');
  const status = c.req.query('status') as 'pending' | 'confirmed' | 'cancelled' | undefined;
  const paymentStatus = c.req.query('paymentStatus') as 'pending' | 'completed' | 'failed' | undefined;
  const offset = (page - 1) * limit;

  let baseQuery = db.select()
    .from(bookings)
    .leftJoin(users, eq(bookings.userId, users.id));

  // Apply filters
  const conditions = [];
  
  if (search) {
    conditions.push(like(users.email, `%${search}%`));
  }
  if (status) {
    conditions.push(eq(bookings.status, status));
  }
  if (paymentStatus) {
    conditions.push(eq(bookings.paymentStatus, paymentStatus));
  }

  const query = conditions.length > 0
    ? baseQuery.where(sql`${conditions[0]}`)
    : baseQuery;

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(query.as('filtered_bookings'));

  // Get paginated results
  const results = await query
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    success: true,
    bookings: results,
    pagination: {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit)
    }
  });
});

// Update any booking
adminRouter.patch('/bookings/:id', zValidator('json', updateBookingSchema), async (c) => {
  const bookingId = c.req.param('id');
  const updates = c.req.valid('json');
  const db = createDbClient(c.env.DB);

  const [existingBooking] = await db.query.bookings.findMany({
    where: eq(bookings.id, bookingId)
  });

  if (!existingBooking) {
    throw new HTTPException(404, { message: 'Booking not found' });
  }

  const updateData = {
    ...(updates.status && { status: updates.status }),
    ...(updates.paymentStatus && { paymentStatus: updates.paymentStatus }),
    ...(updates.date && { date: new Date(updates.date) }),
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

// Delete any booking
adminRouter.delete('/bookings/:id', async (c) => {
  const bookingId = c.req.param('id');
  const db = createDbClient(c.env.DB);

  const [existingBooking] = await db.query.bookings.findMany({
    where: eq(bookings.id, bookingId)
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

export default adminRouter; 