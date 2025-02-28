import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { HTTPException } from 'hono/http-exception';
import { loginSchema, registerSchema } from '../schemas';
import { generateToken, authMiddleware } from '../middleware/auth';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { createDbClient } from '../db';
import { nanoid } from 'nanoid';
import { setCookie } from 'hono/cookie';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const auth = new Hono<{ Bindings: Env }>();

// Login route
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    console.log('Attempting login for:', email);

    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user) {
      console.log('User not found:', email);
      throw new HTTPException(401, { message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      throw new HTTPException(401, { message: 'Invalid credentials' });
    }

    const token = await generateToken({
      id: user.id,
      email: user.email,
      role: user.role as 'user' | 'admin',
      name: user.name
    }, c.env.JWT_SECRET);

    console.log('Generated token for user:', user.id);

    // Set JWT in httpOnly cookie
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: false, // Set to false for local development
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    console.log('Login successful for:', email);
    return c.json({
      success: true,
      token, // Include token in response for client-side storage
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: 'Login failed' });
  }
});

// Register route
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const { email, password, name, phoneNumber } = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    console.log('Attempting registration for:', email);

    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (existingUser) {
      console.log('Email already exists:', email);
      throw new HTTPException(400, { message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = nanoid();

    console.log('Creating user with ID:', userId);

    // Create user
    const [user] = await db.insert(users).values({
      id: userId,
      email,
      password: hashedPassword,
      name,
      phoneNumber,
      role: 'user'
    }).returning();

    console.log('User created:', user.id);

    const token = await generateToken({
      id: user.id,
      email: user.email,
      role: user.role as 'user' | 'admin',
      name: user.name
    }, c.env.JWT_SECRET);

    // Set JWT in httpOnly cookie with updated settings
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    console.log('Registration successful for:', email);
    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: 'Registration failed' });
  }
});

// Get current user info
auth.get('/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    return c.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user info error:', error);
    throw new HTTPException(500, { message: 'Failed to get user info' });
  }
});

// Logout route
auth.post('/logout', async (c) => {
  try {
    // Clear the auth cookie with updated settings
    setCookie(c, 'auth_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: 0 // Expire immediately
    });

    return c.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    throw new HTTPException(500, { message: 'Failed to logout' });
  }
});

export default auth; 