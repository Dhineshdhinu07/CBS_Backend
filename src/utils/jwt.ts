import { SignJWT, jwtVerify } from 'jose';
import { TextEncoder } from 'util';

// JWT implementation using Web Crypto API
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  iat?: number;
  exp?: number;
}

const getSecretKey = (secret: string): Uint8Array => {
  return new TextEncoder().encode(secret);
};

export const sign = async (payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> => {
  try {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 24 * 60 * 60; // 24 hours

    const secretKey = getSecretKey(secret);
    
    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(secretKey);

    console.log('Token generated successfully:', {
      payload,
      iat,
      exp,
      tokenLength: token.length
    });

    return token;
  } catch (error) {
    console.error('Error signing JWT:', error);
    throw new Error('Failed to generate token');
  }
};

export const verify = async (token: string, secret: string): Promise<JWTPayload> => {
  try {
    console.log('Verifying token:', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 20) + '...'
    });

    const secretKey = getSecretKey(secret);
    const { payload } = await jwtVerify(token, secretKey);
    
    console.log('Token verified successfully:', {
      payload
    });

    return payload as JWTPayload;
  } catch (error) {
    console.error('Token verification error:', error);
    throw error;
  }
};

export const generateToken = sign;