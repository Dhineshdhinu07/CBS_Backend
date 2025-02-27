import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import * as jose from 'jose'
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

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  name?: string;
  phoneNumber?: string;
}

export async function generateToken(user: AuthUser, secret: string): Promise<string> {
  try {
    const jwt = await new jose.SignJWT({ 
      id: user.id,
      email: user.email,
      role: user.role 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(secret));
    
    return jwt;
  } catch (error) {
    console.error('Token generation error:', error);
    throw new HTTPException(500, { message: 'Failed to generate token' });
  }
}

export async function verifyToken(token: string, secret: string): Promise<AuthUser> {
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(secret));
    return {
      id: payload.id as string,
      email: payload.email as string,
      role: payload.role as 'user' | 'admin'
    };
  } catch (error) {
    console.error('Token verification error:', error);
    throw new HTTPException(401, { message: 'Invalid token' });
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: () => Promise<void>) {
  try {
    const authHeader = c.req.header('Cookie');
    if (!authHeader) {
      throw new HTTPException(401, { message: 'No token provided' });
    }

    const cookies = authHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = cookies['auth_token'];
    if (!token) {
      throw new HTTPException(401, { message: 'No token provided' });
    }

    const user = await verifyToken(token, c.env.JWT_SECRET);
    console.log('Authenticated user:', user);
    c.set('user', user);
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    throw new HTTPException(401, { message: 'Invalid token' });
  }
}

export async function adminMiddleware(c: Context, next: () => Promise<void>) {
  const user = c.get('user') as AuthUser
  
  if (user.role !== 'admin') {
    throw new HTTPException(403, { message: 'Admin access required' })
  }

  await next()
}