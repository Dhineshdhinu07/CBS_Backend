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

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

export async function generateToken(user: AuthUser): Promise<string> {
  const jwt = await new jose.SignJWT({ 
    id: user.id,
    email: user.email,
    role: user.role 
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET)
  
  return jwt
}

export async function verifyToken(token: string): Promise<AuthUser> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    return payload as unknown as AuthUser
  } catch (error) {
    throw new HTTPException(401, { message: 'Invalid token' })
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: () => Promise<void>) {
  const token = c.req.cookie('auth_token')
  
  if (!token) {
    throw new HTTPException(401, { message: 'No token provided' })
  }

  try {
    const user = await verifyToken(token)
    c.set('user', user)
    await next()
  } catch (error) {
    throw new HTTPException(401, { message: 'Invalid token' })
  }
}

export async function adminMiddleware(c: Context, next: () => Promise<void>) {
  const user = c.get('user') as AuthUser
  
  if (user.role !== 'admin') {
    throw new HTTPException(403, { message: 'Admin access required' })
  }

  await next()
}