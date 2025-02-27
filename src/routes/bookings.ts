import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { bookingSchema, updateBookingSchema } from '../schemas';
import { authMiddleware, AuthUser } from '../middleware/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { bookings, payments } from '../db/schema';
import { createDbClient } from '../db';
import { nanoid } from 'nanoid';

interface Env {
  DB: D1Database;
  Cashfree: any;
}

interface Variables {
  user: AuthUser;
}

const bookingsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes
bookingsRouter.use('*', authMiddleware);

// Create a booking
bookingsRouter.post('/', zValidator('json', bookingSchema), async (c) => {
  try {
    const user = c.get('user');
    const { date: dateString } = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    const date = new Date(dateString);
    console.log('Creating booking for user:', user.id, 'date:', date.toISOString());

    // Check for existing booking at the same time
    const existingBooking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.userId, user.id),
        eq(bookings.date, date)
      )
    });

    if (existingBooking) {
      throw new HTTPException(400, { message: 'You already have a booking at this time' });
    }

    // Create the booking
    const bookingId = nanoid();
    const orderId = `ORDER_${nanoid(8)}`;

    const [booking] = await db.insert(bookings).values({
      id: bookingId,
      userId: user.id,
      date,
      status: 'pending',
      paymentStatus: 'pending',
      paymentId: orderId
    }).returning();

    // Create payment record
    const amount = 500; // Set your consultation fee
    const currency = 'INR';

    const paymentRecord = {
      id: nanoid(),
      orderId,
      paymentSessionId: '', // Will be updated after Cashfree session creation
      amount,
      currency,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.insert(payments).values(paymentRecord);

    // Create Cashfree payment session
    const cashfree = c.env.Cashfree;
    const paymentRequest = {
      order_id: orderId,
      order_amount: amount,
      order_currency: currency,
      customer_details: {
        customer_id: user.id,
        customer_name: user.name || 'Customer',
        customer_email: user.email,
        customer_phone: user.phoneNumber || '0000000000'
      },
      order_meta: {
        return_url: `${c.req.url.split('/bookings')[0]}/payment-status/${orderId}`,
        notify_url: `${c.req.url.split('/bookings')[0]}/payment/webhook`
      },
      order_note: 'Consultation booking'
    };

    const paymentSession = await cashfree.createOrder(paymentRequest);

    // Update payment record with session ID
    await db.update(payments)
      .set({
        paymentSessionId: paymentSession.payment_session_id,
        updatedAt: new Date().toISOString()
      })
      .where(eq(payments.orderId, orderId));

    console.log('Booking created:', booking.id, 'with payment session:', paymentSession.payment_session_id);

    return c.json({
      success: true,
      booking,
      payment: {
        orderId,
        amount,
        currency,
        paymentSessionId: paymentSession.payment_session_id
      }
    });
  } catch (error) {
    console.error('Create booking error:', error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: 'Failed to create booking' });
  }
});

// Get user's bookings with pagination
bookingsRouter.get('/my', async (c) => {
  try {
    const user = c.get('user');
    const db = createDbClient(c.env.DB);
    const page = Number(c.req.query('page') || '1');
    const limit = Number(c.req.query('limit') || '10');
    const offset = (page - 1) * limit;

    console.log('Fetching bookings for user:', user.id, 'page:', page, 'limit:', limit);

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

    console.log('Found bookings:', userBookings.length);

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
  } catch (error) {
    console.error('Get bookings error:', error);
    throw new HTTPException(500, { message: 'Failed to fetch bookings' });
  }
});

// Update a booking
bookingsRouter.patch('/:id', zValidator('json', updateBookingSchema), async (c) => {
  try {
    const user = c.get('user');
    const bookingId = c.req.param('id');
    const updates = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    console.log('Updating booking:', bookingId, 'for user:', user.id);

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
      ...(updates.date && { date: new Date(updates.date) }),
      updatedAt: new Date()
    };

    const [updatedBooking] = await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning();

    console.log('Booking updated:', updatedBooking.id);

    return c.json({
      success: true,
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Update booking error:', error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: 'Failed to update booking' });
  }
});

// Delete a booking
bookingsRouter.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const bookingId = c.req.param('id');
    const db = createDbClient(c.env.DB);

    console.log('Deleting booking:', bookingId, 'for user:', user.id);

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

    console.log('Booking deleted:', bookingId);

    return c.json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: 'Failed to delete booking' });
  }
});

export default bookingsRouter; 