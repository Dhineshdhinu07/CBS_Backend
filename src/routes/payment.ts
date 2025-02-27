import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { payments } from '../db/schema';
import { createDbClient } from '../db';
import { nanoid } from 'nanoid';

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
        return_url: `${c.req.url.split('/payment')[0]}/payment-status/${body.order_id}`,
        notify_url: `${c.req.url.split('/payment')[0]}/payment/webhook`,
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

export default paymentRouter; 