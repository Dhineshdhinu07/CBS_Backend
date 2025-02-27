// src/controllers/auth.ts
import { Context } from 'hono';
import { AuthService } from '../services/auth';
import { drizzle } from 'drizzle-orm/d1';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phoneNumber: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phoneNumber: z.string().optional(),
  profileImage: z.string().optional()
});

// Register endpoint
export const register = async (c: Context) => {
  try {
    let data;
    try {
      data = await c.req.json();
    } catch (error) {
      throw new HTTPException(400, { 
        message: 'Invalid JSON payload',
        cause: error instanceof Error ? error.message : 'Unknown parsing error'
      });
    }

    // Check if data is an object
    if (typeof data !== 'object' || data === null) {
      throw new HTTPException(400, { 
        message: 'Invalid request format',
        cause: 'Request body must be a JSON object'
      });
    }

    let validatedData;
    try {
      validatedData = registerSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }, 400);
      }
      throw error;
    }

    const db = drizzle(c.env.DB);
    const authService = new AuthService(db, c.env.JWT_SECRET);
    
    const result = await authService.register(validatedData);

    return c.json({
      success: true,
      ...result
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof HTTPException) {
      return c.json({
        success: false,
        message: error.message,
        cause: error.cause
      }, error.status);
    }

    return c.json({
      success: false,
      message: 'Registration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};

// Login endpoint
export const login = async (c: Context) => {
  try {
    let data;
    try {
      data = await c.req.json();
    } catch (error) {
      throw new HTTPException(400, { 
        message: 'Invalid JSON payload',
        cause: error instanceof Error ? error.message : 'Unknown parsing error'
      });
    }

    // Check if data is an object
    if (typeof data !== 'object' || data === null) {
      throw new HTTPException(400, { 
        message: 'Invalid request format',
        cause: 'Request body must be a JSON object'
      });
    }

    let validatedData;
    try {
      validatedData = loginSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }, 400);
      }
      throw error;
    }

    const db = drizzle(c.env.DB);
    const authService = new AuthService(db, c.env.JWT_SECRET);
    
    const result = await authService.login(validatedData);

    return c.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof HTTPException) {
      return c.json({
        success: false,
        message: error.message,
        cause: error.cause
      }, error.status);
    }

    return c.json({
      success: false,
      message: 'Login failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};

// Get current user profile
export const getProfile = async (c: Context) => {
  try {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    const { password, ...userWithoutPassword } = user;
    return c.json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Get profile error:', error);
    
    if (error instanceof HTTPException) {
      return c.json({
        success: false,
        message: error.message
      }, error.status);
    }

    return c.json({
      success: false,
      message: 'Failed to get profile'
    }, 500);
  }
};

// Update user profile
export const updateProfile = async (c: Context) => {
  try {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    const data = await c.req.json();
    const validatedData = updateProfileSchema.parse(data);

    const db = drizzle(c.env.DB);
    const authService = new AuthService(db);
    
    const updatedUser = await authService.updateProfile(user.id, validatedData);

    return c.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        message: 'Validation failed',
        errors: error.errors
      }, 400);
    }

    if (error instanceof HTTPException) {
      return c.json({
        success: false,
        message: error.message
      }, error.status);
    }

    return c.json({
      success: false,
      message: 'Failed to update profile'
    }, 500);
  }
};