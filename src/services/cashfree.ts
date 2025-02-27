// Types for Cashfree requests and responses
export interface OrderRequest {
  order_id: string;
  order_amount: number;
  order_currency: string;
  customer_details: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
  };
  order_meta?: Record<string, any>;
  order_note?: string;
}

export interface PaymentResponse {
  order_id: string;
  payment_session_id: string;
  order_status: string;
  payment_method: string | null;
  payment_time: string | null;
}

interface CashfreeError {
  message: string;
  code?: string;
  type?: string;
}

interface CashfreeOrderResponse {
  order_id: string;
  payment_session_id: string;
  order_status: string;
}

interface CashfreePaymentResponse {
  payment_status: string;
  payment_method?: string;
  payment_time?: string;
}

interface CashfreeOrderStatusResponse {
  order_id: string;
  payment_session_id: string;
  order_status: string;
  payment_method?: string;
  payment_time?: string;
}

// Helper function to generate HMAC signature using Web Crypto API
async function generateSignature(data: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(data))
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export const createCashfreeService = (
  clientId: string,
  clientSecret: string,
  environment: 'SANDBOX' | 'PRODUCTION',
  apiVersion: string
) => {
  const baseUrl = environment === 'PRODUCTION' 
    ? 'https://api.cashfree.com/pg' 
    : 'https://sandbox.cashfree.com/pg';

  const headers = {
    'x-api-version': apiVersion,
    'x-client-id': clientId,
    'x-client-secret': clientSecret,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  return {
    createOrder: async (orderData: OrderRequest): Promise<PaymentResponse> => {
      try {
        console.log('Creating order with data:', JSON.stringify(orderData));
        console.log('Using headers:', JSON.stringify(headers));
        
        const response = await fetch(`${baseUrl}/orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(orderData)
        });

        console.log('Response status:', response.status);
        const responseData = await response.json();
        console.log('Response data:', JSON.stringify(responseData));

        if (!response.ok) {
          throw new Error(`Failed to create order: ${JSON.stringify(responseData)}`);
        }

        const data = responseData as CashfreeOrderResponse;

        if (!data.order_id || !data.payment_session_id) {
          throw new Error(`Invalid response from Cashfree: ${JSON.stringify(data)}`);
        }

        return {
          order_id: data.order_id,
          payment_session_id: data.payment_session_id,
          order_status: data.order_status || 'PENDING',
          payment_method: null,
          payment_time: null
        };
      } catch (error) {
        console.error('Cashfree create order error:', error);
        throw error;
      }
    },

    verifyOrder: async (orderId: string): Promise<PaymentResponse> => {
      try {
        const response = await fetch(`${baseUrl}/orders/${orderId}`, {
          method: 'GET',
          headers
        });

        let responseData;
        try {
          responseData = await response.json();
        } catch (error) {
          throw new Error('Invalid response from Cashfree API');
        }

        if (!response.ok) {
          const error = responseData as CashfreeError;
          throw new Error(error.message || 'Failed to verify order');
        }

        const data = responseData as CashfreeOrderStatusResponse;
        console.log('Order verification response:', JSON.stringify(data));

        if (!data.order_id || !data.order_status) {
          throw new Error('Invalid response format from Cashfree');
        }

        return {
          order_id: data.order_id,
          payment_session_id: data.payment_session_id,
          order_status: data.order_status || 'UNKNOWN',
          payment_method: data.payment_method || null,
          payment_time: data.payment_time || null
        };
      } catch (error) {
        console.error('Cashfree verify order error:', error);
        throw error;
      }
    },

    verifyWebhookSignature: async (payload: any, signature: string): Promise<boolean> => {
      try {
        const expectedSignature = await generateSignature(payload, clientSecret);
        return signature === expectedSignature;
      } catch (error) {
        console.error('Webhook signature verification error:', error);
        return false;
      }
    }
  };
};