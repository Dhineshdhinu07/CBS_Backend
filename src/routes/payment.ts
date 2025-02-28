import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { payments, bookings } from '../db/schema';
import { createDbClient } from '../db';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

interface Env {
  DB: D1Database;
  Cashfree: any;
}

const paymentRouter = new Hono<{ Bindings: Env }>();

// Create payment session
paymentRouter.post('/', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    const cashfree = c.env.Cashfree;
    const body = await c.req.json();
    
    console.log('Payment request body:', body);
    
    // Validate request
    if (!body.order_id || !body.order_amount || !body.order_currency || !body.customer_details) {
      throw new HTTPException(400, { message: 'Missing required payment fields' });
    }

    // Ensure customer_phone is set
    const customerPhone = body.customer_details.customer_phone || '0000000000';

    // Get frontend URL from request origin or use default
    const frontendUrl = c.req.header('Origin') || 'http://localhost:3000';

    // Prepare request to Cashfree API
    const paymentRequest = {
      order_id: body.order_id,
      order_amount: body.order_amount,
      order_currency: body.order_currency,
      customer_details: {
        customer_id: body.customer_details.customer_id,
        customer_name: body.customer_details.customer_name,
        customer_email: body.customer_details.customer_email || 'test@example.com',
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${frontendUrl}/payment-status/${body.order_id}`,
        notify_url: `${c.req.url.split('/payment')[0]}/payments/webhook`,
        ...body.order_meta
      },
      order_note: 'Consultation booking',
    };

    console.log('Cashfree payment request:', paymentRequest);

    // Call Cashfree API to create order and get payment session
    const data = await cashfree.createOrder(paymentRequest);
    console.log('Payment creation response:', data);

    // Store initial payment info
    const paymentRecord = {
      id: nanoid(),
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id,
      amount: body.order_amount,
      currency: body.order_currency,
      status: data.order_status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Creating payment record:', paymentRecord);
    await db.insert(payments).values(paymentRecord);

    return c.json({
      success: true,
      order_id: data.order_id,
      payment_session_id: data.payment_session_id,
      order_status: data.order_status
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    if (error instanceof HTTPException) {
      return c.json({ success: false, message: error.message }, error.status);
    }
    return c.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Internal server error',
      error: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

// Verify payment status - GET endpoint
paymentRouter.get('/verify/:orderId', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    return await verifyPayment(c, orderId);
  } catch (error) {
    console.error('Payment verification error:', error);
    if (error instanceof HTTPException) {
      return c.json({ success: false, message: error.message }, error.status);
    }
    return c.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Internal server error' 
    }, 500);
  }
});

// Verify payment status - POST endpoint
paymentRouter.post('/verify', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.orderId) {
      throw new HTTPException(400, { message: 'Order ID is required' });
    }
    return await verifyPayment(c, body.orderId);
  } catch (error) {
    console.error('Payment verification error:', error);
    if (error instanceof HTTPException) {
      return c.json({ success: false, message: error.message }, error.status);
    }
    return c.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Internal server error' 
    }, 500);
  }
});

// Helper function to verify payment
async function verifyPayment(c: any, orderId: string) {
  const db = createDbClient(c.env.DB);
  const cashfree = c.env.Cashfree;

  // Get existing payment record
  const [existingPayment] = await db.select()
    .from(payments)
    .where(eq(payments.orderId, orderId));

  if (!existingPayment) {
    throw new HTTPException(404, { message: 'Payment record not found' });
  }

  // Get order details from Cashfree
  const paymentData = await cashfree.verifyOrder(orderId);
  console.log('Payment verification response:', paymentData);

  // Update payment status
  await db.update(payments)
    .set({
      status: paymentData.order_status,
      paymentMethod: paymentData.payment_method,
      paymentTime: paymentData.payment_time,
      updatedAt: new Date().toISOString()
    })
    .where(eq(payments.orderId, orderId));

  // Update booking status if payment is successful
  if (paymentData.order_status === 'PAID') {
    await db.update(bookings)
      .set({ 
        status: 'confirmed',
        paymentStatus: 'completed',
        updatedAt: new Date()
      })
      .where(eq(bookings.paymentId, orderId));
  }

  return c.json({
    success: true,
    status: paymentData.order_status,
    order_id: paymentData.order_id,
    payment_details: {
      method: paymentData.payment_method,
      time: paymentData.payment_time,
      amount: existingPayment.amount,
      currency: existingPayment.currency
    }
  });
}

export default paymentRouter; 