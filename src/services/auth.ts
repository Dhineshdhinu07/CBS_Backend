// src/services/auth.ts
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { users, User } from '../db/schema';
import bcrypt from 'bcryptjs';
import { generateToken, verify } from '../utils/jwt';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phoneNumber?: string;
}

interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  constructor(
    private db: DrizzleD1Database,
    private jwtSecret: string = 'your-jwt-secret'
  ) {}

  private async validateEmail(email: string): Promise<void> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new HTTPException(400, { message: 'Invalid email format' });
    }

    const [existingUser] = await this.db.select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (existingUser) {
      throw new HTTPException(409, { message: 'Email already registered' });
    }
  }

  private async validatePassword(password: string): Promise<void> {
    if (password.length < 8) {
      throw new HTTPException(400, { message: 'Password must be at least 8 characters long' });
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

    if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
      throw new HTTPException(400, {
        message: 'Password must contain uppercase, lowercase, numbers, and special characters'
      });
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Validate input
      await this.validateEmail(data.email);
      await this.validatePassword(data.password);

      if (!data.name || data.name.trim().length < 2) {
        throw new HTTPException(400, { message: 'Name is required and must be at least 2 characters' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user
      const [user] = await this.db.insert(users)
        .values({
          id: crypto.randomUUID(),
          email: data.email.toLowerCase(),
          password: hashedPassword,
          name: data.name.trim(),
          phoneNumber: data.phoneNumber?.trim() || ''
        })
        .returning();

      if (!user) {
        throw new Error('Failed to create user');
      }

      // Generate JWT token
      const token = await generateToken(
        { userId: user.id, email: user.email },
        this.jwtSecret
      );

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      console.error('Registration error in service:', error);
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(500, { 
        message: 'Failed to register user',
        cause: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const [user] = await this.db.select()
        .from(users)
        .where(eq(users.email, data.email.toLowerCase()));

      if (!user) {
        throw new HTTPException(401, { message: 'Invalid email or password' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(data.password, user.password);
      if (!isValidPassword) {
        console.log('Password validation failed for user:', user.email);
        throw new HTTPException(401, { message: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = await generateToken(
        { userId: user.id, email: user.email },
        this.jwtSecret
      );

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      console.error('Login error in service:', error);
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(500, { 
        message: 'Failed to login',
        cause: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async validateToken(token: string): Promise<Omit<User, 'password'>> {
    try {
      const decoded = await verify(token, this.jwtSecret);
      
      const [user] = await this.db.select()
        .from(users)
        .where(eq(users.id, decoded.userId));

      if (!user) {
        throw new HTTPException(401, { message: 'User not found' });
      }

      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw new HTTPException(401, { message: 'Invalid token' });
    }
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<Omit<User, 'password'>> {
    try {
      // Don't allow updating sensitive fields
      const { password, ...updateData } = data;

      const [updatedUser] = await this.db.update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new Error('User not found');
      }

      const { password: _, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      console.error('Update profile error in service:', error);
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(500, { 
        message: 'Failed to update profile',
        cause: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}