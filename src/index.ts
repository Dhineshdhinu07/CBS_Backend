import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware } from './middleware/auth'
import { users } from './db/schema'
import { createCashfreeService } from './services/cashfree'
import { createZohoService } from './services/zoho'

// Import routers
import authRouter from './routes/auth'
import bookingsRouter from './routes/bookings'
import paymentRouter from './routes/payment'
import adminRouter from './routes/admin'

// Define environment bindings
interface Env {
  DB: D1Database;
  Cashfree: any;
  Zoho: any;
  JWT_SECRET: string;
  CASHFREE_CLIENT_ID: string;
  CASHFREE_CLIENT_SECRET: string;
  CASHFREE_API_VERSION: string;
  ZOHO_CLIENT_ID: string;
  ZOHO_CLIENT_SECRET: string;
  ZOHO_REFRESH_TOKEN: string;
  FRONTEND_URL?: string;
}

// Define custom variables
interface Variables {
  user?: typeof users.$inferSelect;
}

// Create app with proper types
const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// Add CORS middleware with more permissive settings
app.use('*', cors({
  origin: ['http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposeHeaders: ['Set-Cookie', 'Content-Length', 'X-Kuma-Revision'],
  credentials: true,
  maxAge: 86400
}))

// Initialize services
app.use('*', async (c, next) => {
  // Create Cashfree service instance
  const cashfreeService = createCashfreeService(
    c.env.CASHFREE_CLIENT_ID, 
    c.env.CASHFREE_CLIENT_SECRET,
    'SANDBOX',
    c.env.CASHFREE_API_VERSION
  )
  
  // Create Zoho service instance
  const zohoService = createZohoService(
    c.env.ZOHO_CLIENT_ID,
    c.env.ZOHO_CLIENT_SECRET,
    c.env.ZOHO_REFRESH_TOKEN,
    'development'
  )
  
  // Add services to env for controllers to use
  c.env.Cashfree = cashfreeService
  c.env.Zoho = zohoService
  
  await next()
})

// Mount routers
app.route('/auth', authRouter)
app.route('/bookings', bookingsRouter)
app.route('/payments', paymentRouter)
app.route('/admin', adminRouter)

// Error handling middleware
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      message: err.message
    }, err.status);
  }

  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    message: 'Internal server error'
  }, 500);
});

// Health check endpoint
app.get('/', (c) => c.json({ status: 'ok' }));

export default app