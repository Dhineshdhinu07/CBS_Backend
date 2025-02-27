// JWT implementation using Web Crypto API
interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

interface JWTHeader {
  alg: string;
  typ: string;
}

const base64UrlEncode = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const base64UrlDecode = (str: string): string => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const base64 = atob(str);
  const bytes = new Uint8Array(base64.length);
  for (let i = 0; i < base64.length; i++) {
    bytes[i] = base64.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};

const utf8ToUint8Array = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

const uint8ArrayToString = (arr: Uint8Array): string => {
  return new TextDecoder().decode(arr);
};

const generateKey = async (secret: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
};

export const sign = async (payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> => {
  const header: JWTHeader = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60) // 24 hours
  };

  const stringifiedHeader = JSON.stringify(header);
  const stringifiedPayload = JSON.stringify(fullPayload);

  const encodedHeader = base64UrlEncode(stringifiedHeader);
  const encodedPayload = base64UrlEncode(stringifiedPayload);

  const key = await generateKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    utf8ToUint8Array(`${encodedHeader}.${encodedPayload}`)
  );

  const signatureBytes = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));
  const encodedSignature = signatureBase64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
};

export const verify = async (token: string, secret: string): Promise<JWTPayload> => {
  const [headerB64, payloadB64, signatureB64] = token.split('.');

  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error('Invalid token format');
  }

  const key = await generateKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    utf8ToUint8Array(`${headerB64}.${payloadB64}`)
  );

  const signatureBytes = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));
  const expectedSignature = signatureBase64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  if (signatureB64 !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload;
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
};

export const generateToken = sign;