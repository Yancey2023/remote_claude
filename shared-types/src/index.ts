// ── WebSocket Message Protocol ──

export interface WsMessage {
  type: string;
  payload: Record<string, unknown>;
}

// Client ↔ Server
export interface RegisterPayload {
  token: string;
  name: string;
  version: string;
}

export interface RegisteredPayload {
  device_id: string;
}

export interface CommandPayload {
  session_id: string;
  command: string;
}

export interface ResultChunkPayload {
  session_id: string;
  chunk: string;
  done: boolean;
}

export interface StatusUpdatePayload {
  online: boolean;
  busy: boolean;
}

// Web ↔ Server (REST)
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: string;
  username: string;
  role: 'Admin' | 'User';
}

export interface DeviceResponse {
  id: string;
  name: string;
  version: string;
  online: boolean;
  busy: boolean;
  last_seen: number;
}

export interface SessionResponse {
  session_id: string;
  ws_url: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  role: string;
  enabled: boolean;
  created_at: number;
}

export interface ApiError {
  code: string;
  message: string;
}

// Web ↔ Server (WS control)
export interface SessionCreatedPayload {
  session_id: string;
  device_id: string;
}

export interface DeviceStatusPayload {
  device_id: string;
  online: boolean;
}

export interface ErrorPayload {
  session_id?: string;
  code: string;
  message: string;
}

// Terminal forwarding (PTY)
export interface TerminalInputPayload {
  session_id: string;
  data: string;
}

export interface TerminalResizePayload {
  session_id: string;
  cols: number;
  rows: number;
}

export interface SessionClosedPayload {
  session_id: string;
}
