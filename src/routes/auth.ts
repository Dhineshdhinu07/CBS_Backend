import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { HTTPException } from 'hono/http-exception';
import { loginSchema } from '../schemas';
import { generateToken, authMiddleware } from '../middleware/auth';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { createDbClient } from '../db';

const auth = new Hono();

// Login route
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const db = createDbClient(c.env.DB);

  const user = await db.query.users.findFirst({
    where: eq(users.email, email)
  });

  if (!user || !await bcrypt.compare(password, user.password)) {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  const token = await generateToken({
    id: user.id,
    email: user.email,
    role: user.role as 'user' | 'admin'
  });

  // Set JWT in httpOnly cookie
  c.cookie('auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 60 * 60 * 24 // 24 hours
  });

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  });
});

// Get current user info
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    user
  });
});

export default auth; 