import type {
  LoginRequest,
  LoginResponse,
  DeviceResponse,
  SessionResponse,
  TokenResponse,
  UserResponse,
  ApiError,
} from '../types/protocol';
import { getConfig } from '../config';

class ApiClient {
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Auth via HttpOnly cookie (auto-sent by browser)

    const baseUrl = getConfig().apiBaseUrl;
    const res = await fetch(`${baseUrl}${path}`, {
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
    const res = await this.request<LoginResponse>('POST', '/auth/login', data);
    return res;
  }

  async logout() {
    await this.request('POST', '/auth/logout');
  }

  async verify() {
    return this.request<{ valid: boolean; user_id: string; username: string; role: string; token: string }>(
      'POST',
      '/auth/verify',
    );
  }

  // Devices
  async listDevices() {
    return this.request<DeviceResponse[]>('GET', '/devices');
  }

  async deleteDevice(deviceId: string) {
    return this.request('DELETE', `/devices/${deviceId}`);
  }

  // Sessions
  async createSession(deviceId: string, cwd?: string) {
    return this.request<import('../types/protocol').SessionResponse>('POST', '/sessions', { device_id: deviceId, cwd: cwd ?? null });
  }

  async listSessions() {
    return this.request<import('../types/protocol').SessionInfo[]>('GET', '/sessions');
  }

  async getSession(sessionId: string) {
    return this.request<import('../types/protocol').SessionInfo>('GET', `/sessions/${sessionId}`);
  }

  async closeSession(sessionId: string) {
    return this.request('DELETE', `/sessions/${sessionId}`);
  }

  // Admin - User Management
  async listUsers() {
    return this.request<UserResponse[]>('GET', '/admin/users');
  }

  async createUser(username: string, password: string) {
    return this.request<UserResponse>('POST', '/admin/users', { username, password });
  }

  async deleteUser(id: string) {
    return this.request('DELETE', `/admin/users/${id}`);
  }

  async toggleUserStatus(id: string, enabled: boolean) {
    return this.request('PATCH', `/admin/users/${id}/status`, { enabled });
  }

  // Client Tokens
  async createToken() {
    return this.request<TokenResponse>('POST', '/tokens');
  }

  async listTokens() {
    return this.request<TokenResponse[]>('GET', '/tokens');
  }

  async deleteToken(token: string) {
    return this.request('DELETE', `/tokens/${encodeURIComponent(token)}`);
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
