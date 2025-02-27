import { Context, Next } from 'hono'
import { verify } from '../utils/jwt'
import { drizzle } from 'drizzle-orm/d1'
import { users, User } from '../db/schema'
import { eq } from 'drizzle-orm'

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

interface Variables {
  user: User;
}

export const authMiddleware = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  try {
    // Get the authorization header
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        message: 'No token provided' 
      }, 401)
    }

    // Extract the token
    const token = authHeader.split(' ')[1]
    
    try {
      // Verify the token
      const decoded = await verify(token, c.env.JWT_SECRET)
      
      if (!decoded || !decoded.userId) {
        return c.json({ 
          success: false, 
          message: 'Invalid token' 
        }, 401)
      }

      // Get user from database
      const db = drizzle(c.env.DB)
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, decoded.userId))
      
      if (!user) {
        return c.json({ 
          success: false, 
          message: 'User not found' 
        }, 401)
      }

      // Set user in context with proper typing
      c.set('user', user)
      
      // Continue to next middleware/route handler
      await next()
    } catch (error) {
      return c.json({ 
        success: false, 
        message: 'Invalid token' 
      }, 401)
    }
  } catch (error) {
    return c.json({ 
      success: false, 
      message: 'Authentication failed' 
    }, 500)
  }
}