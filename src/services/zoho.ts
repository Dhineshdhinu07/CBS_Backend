// Types for Zoho Meeting
export interface ZohoMeetingRequest {
  topic: string;
  startTime: string; // ISO string
  duration: number; // in minutes
  timezone?: string;
  password?: string;
  description?: string;
  isRecurring?: boolean;
  recurrenceConfig?: {
    repeatInterval: number;
    repeatFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    repeatUntil: string;
  };
}

export interface ZohoMeetingResponse {
  meeting_id: string;
  join_url: string;
  start_url: string;
  password?: string;
  status: string;
  start_time: string;
  duration: number;
  topic: string;
}

interface ZohoAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export const createZohoService = (
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  environment: 'development' | 'production'
) => {
  const baseUrl = environment === 'production'
    ? 'https://meeting.zoho.com/api/v2'
    : 'https://meeting.zoho.com/api/v2';
  
  let accessToken: string | null = null;
  let tokenExpiry: number | null = null;

  const getAccessToken = async (): Promise<string> => {
    // Check if we have a valid token
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    try {
      const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get access token');
      }

      const data = await response.json() as ZohoAuthResponse;
      accessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000) - 300000; // Subtract 5 minutes for safety
      
      return accessToken;
    } catch (error) {
      console.error('Zoho auth error:', error);
      throw new Error('Failed to authenticate with Zoho');
    }
  };

  const getHeaders = async () => {
    const token = await getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  return {
    createMeeting: async (meetingData: ZohoMeetingRequest): Promise<ZohoMeetingResponse> => {
      try {
        const headers = await getHeaders();
        
        const response = await fetch(`${baseUrl}/meetings`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            topic: meetingData.topic,
            start_time: meetingData.startTime,
            duration: meetingData.duration,
            timezone: meetingData.timezone || 'Asia/Kolkata',
            password: meetingData.password,
            description: meetingData.description,
            is_recurring: meetingData.isRecurring || false,
            recurrence_config: meetingData.recurrenceConfig,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to create meeting: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return {
          meeting_id: data.meeting_id,
          join_url: data.join_url,
          start_url: data.start_url,
          password: data.password,
          status: data.status,
          start_time: data.start_time,
          duration: data.duration,
          topic: data.topic,
        };
      } catch (error) {
        console.error('Zoho create meeting error:', error);
        throw error;
      }
    },

    getMeeting: async (meetingId: string): Promise<ZohoMeetingResponse> => {
      try {
        const headers = await getHeaders();
        
        const response = await fetch(`${baseUrl}/meetings/${meetingId}`, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to get meeting: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return {
          meeting_id: data.meeting_id,
          join_url: data.join_url,
          start_url: data.start_url,
          password: data.password,
          status: data.status,
          start_time: data.start_time,
          duration: data.duration,
          topic: data.topic,
        };
      } catch (error) {
        console.error('Zoho get meeting error:', error);
        throw error;
      }
    },

    updateMeeting: async (meetingId: string, meetingData: Partial<ZohoMeetingRequest>): Promise<ZohoMeetingResponse> => {
      try {
        const headers = await getHeaders();
        
        const response = await fetch(`${baseUrl}/meetings/${meetingId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(meetingData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to update meeting: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return {
          meeting_id: data.meeting_id,
          join_url: data.join_url,
          start_url: data.start_url,
          password: data.password,
          status: data.status,
          start_time: data.start_time,
          duration: data.duration,
          topic: data.topic,
        };
      } catch (error) {
        console.error('Zoho update meeting error:', error);
        throw error;
      }
    },

    deleteMeeting: async (meetingId: string): Promise<boolean> => {
      try {
        const headers = await getHeaders();
        
        const response = await fetch(`${baseUrl}/meetings/${meetingId}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to delete meeting: ${JSON.stringify(error)}`);
        }

        return true;
      } catch (error) {
        console.error('Zoho delete meeting error:', error);
        throw error;
      }
    },
  };
}; 