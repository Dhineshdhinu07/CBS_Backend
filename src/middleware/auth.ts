import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { sign, verify } from '../utils/jwt'
import { drizzle } from 'drizzle-orm/d1'
import { users, User } from '../db/schema'
import { eq } from 'drizzle-orm'

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export type AuthUser = User;

interface Variables {
  user: AuthUser;
}

export const generateToken = async (payload: {
  id: string;
  email: string;
  role: 'user' | 'admin';
}, secret: string): Promise<string> => {
  return sign({
    userId: payload.id,
    email: payload.email,
    role: payload.role
  }, secret);
};

export const authMiddleware = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  try {
    // Get the token from cookie or Authorization header
    let token = getCookie(c, 'auth_token');
    if (!token) {
      const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    console.log('Auth token:', token ? 'Present' : 'Not present');
    
    if (!token) {
      return c.json({ 
        success: false, 
        message: 'No authentication token provided' 
      }, 401);
    }

    try {
      // Verify the token
      const decoded = await verify(token, c.env.JWT_SECRET);
      console.log('Token decoded:', decoded);
      
      if (!decoded || !decoded.userId) {
        return c.json({ 
          success: false, 
          message: 'Invalid token format' 
        }, 401);
      }

      // Get user from database
      const db = drizzle(c.env.DB);
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, decoded.userId));
      
      if (!user) {
        return c.json({ 
          success: false, 
          message: 'User not found' 
        }, 401);
      }

      // Set user in context
      c.set('user', user);
      
      // Continue to next middleware/route handler
      await next();
    } catch (error) {
      console.error('Token verification error:', error);
      return c.json({ 
        success: false, 
        message: 'Invalid or expired token',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 401);
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return c.json({ 
      success: false, 
      message: 'Authentication failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};

// Admin middleware
export const adminMiddleware = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  const user = c.get('user');
  
  if (user.role !== 'admin') {
    return c.json({
      success: false,
      message: 'Admin access required'
    }, 403);
  }
  
  await next();
};