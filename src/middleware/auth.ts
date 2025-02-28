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
  name: string;
}, secret: string): Promise<string> => {
  console.log('Generating token for payload:', payload);
  return sign({
    userId: payload.id,
    email: payload.email,
    role: payload.role,
    name: payload.name
  }, secret);
};

const extractToken = (c: Context): string | null => {
  // First try to get from cookie
  let token = getCookie(c, 'auth_token');
  if (token) {
    console.log('Token found in cookie');
    return token;
  }

  // Then try Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log('Token found in Authorization header');
    return token;
  }

  console.log('No token found in cookie or Authorization header');
  return null;
};

export const authMiddleware = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  try {
    const token = extractToken(c);
    
    if (!token) {
      console.log('Authentication failed: No token provided');
      return c.json({ 
        success: false, 
        message: 'No authentication token provided' 
      }, 401);
    }

    try {
      console.log('Attempting to verify token');
      const decoded = await verify(token, c.env.JWT_SECRET);
      console.log('Token verified successfully:', decoded);
      
      if (!decoded || !decoded.userId) {
        console.log('Authentication failed: Invalid token format');
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
        console.log('Authentication failed: User not found');
        return c.json({ 
          success: false, 
          message: 'User not found' 
        }, 401);
      }

      console.log('User authenticated successfully:', {
        userId: user.id,
        email: user.email,
        role: user.role
      });

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