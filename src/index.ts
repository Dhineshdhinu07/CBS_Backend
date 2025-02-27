import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { register, login, getProfile, updateProfile } from './controllers/auth'
import { authMiddleware } from './middleware/auth'
import { users } from './db/schema'
import { createCashfreeService } from './services/cashfree'
import { createZohoService } from './services/zoho'

// // Import controllers
import paymentController from './controllers/payment'
import bookingController from './controllers/booking'
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
}

// Define custom variables
interface Variables {
  user?: typeof users.$inferSelect;
}

// Create app with proper types
const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// Add CORS middleware
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-webhook-signature'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  maxAge: 600,
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

// Authentication routes
app.post('/auth/register', register)
app.post('/auth/login', login)

// Protected routes
app.use('/user/*', authMiddleware)
app.use('/meetings/*', authMiddleware)
app.use('/bookings/*', authMiddleware)

// User profile routes
app.get('/user/profile', getProfile)
app.patch('/user/profile', updateProfile)

// Payment, booking, and meeting routes
app.route('/', paymentController)
app.route('/', bookingController)
// app.route('/', meetingController)

export default app