import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm/sql'
import { HTTPException } from 'hono/http-exception'
import { bookings } from '../db/schema'

// Define env type for this controller
type Env = {
  DB: D1Database
}

// Initialize router
const app = new Hono<{ Bindings: Env }>()

// Create booking
app.post('/bookings', async (c) => {
  try {
    const db = drizzle(c.env.DB)
    const body = await c.req.json()
    
    // Validate request
    if (!body.userId || !body.orderId || !body.consultationDate || !body.name || !body.email || !body.phoneNumber || !body.amount) {
      throw new HTTPException(400, { message: 'Missing required booking fields' })
    }

    // Insert booking record
    await db.insert(bookings).values({
      id: crypto.randomUUID(),
      userId: body.userId,
      orderId: body.orderId,
      consultationDate: body.consultationDate,
      name: body.name,
      email: body.email,
      phoneNumber: body.phoneNumber,
      files: body.files || null,
      amount: body.amount,
      isGuest: body.isGuest || false,
      status: 'Pending'
    })

    return c.json({
      success: true,
      message: 'Booking created successfully'
    })
  } catch (error) {
    console.error('Booking creation error:', error)
    if (error instanceof HTTPException) {
      return c.json({ success: false, message: error.message }, error.status)
    }
    return c.json({ success: false, message: 'Internal server error' }, 500)
  }
})

// Get booking details
app.get('/bookings/:id', async (c) => {
  try {
    const db = drizzle(c.env.DB)
    const id = c.req.param('id')
    
    const result = await db.select()
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1)
    
    if (result.length === 0) {
      throw new HTTPException(404, { message: 'Booking not found' })
    }
    
    return c.json({
      success: true,
      booking: result[0]
    })
  } catch (error) {
    console.error('Get booking error:', error)
    if (error instanceof HTTPException) {
      return c.json({ success: false, message: error.message }, error.status)
    }
    return c.json({ success: false, message: 'Internal server error' }, 500)
  }
})

// Get user bookings
app.get('/user/bookings/:userId', async (c) => {
  try {
    const db = drizzle(c.env.DB)
    const userId = c.req.param('userId')
    
    const results = await db.select()
      .from(bookings)
      .where(eq(bookings.userId, userId))
      .orderBy(sql`created_at DESC`)
    
    return c.json({
      success: true,
      bookings: results
    })
  } catch (error) {
    console.error('Get user bookings error:', error)
    return c.json({ success: false, message: 'Internal server error' }, 500)
  }
})

export default app