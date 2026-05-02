import type {
  LoginRequest,
  LoginResponse,
  DeviceResponse,
  SessionResponse,
  ApiError,
} from '../types/protocol';

const BASE_URL = ''; // vite proxy handles /api -> localhost:8080

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err: ApiError = await res.json().catch(() => ({
        code: 'ERR_UNKNOWN',
        message: res.statusText,
      }));
      throw new ApiClientError(err.code, err.message, res.status);
    }

    return res.json();
  }

  // Auth
  async login(data: LoginRequest) {
    const res = await this.request<LoginResponse>('POST', '/api/auth/login', data);
    return res;
  }

  async logout() {
    await this.request('POST', '/api/auth/logout');
  }

  async verify() {
    return this.request<{ valid: boolean; user_id: string; username: string; role: string }>(
      'POST',
      '/api/auth/verify',
    );
  }

  // Devices
  async listDevices() {
    return this.request<DeviceResponse[]>('GET', '/api/devices');
  }

  // Sessions
  async createSession(deviceId: string) {
    return this.request<SessionResponse>('POST', '/api/sessions', { device_id: deviceId });
  }

  async closeSession(sessionId: string) {
    return this.request('DELETE', `/api/sessions/${sessionId}`);
  }
}

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export const apiClient = new ApiClient();
