export type {
  WsMessage,
  RegisterPayload,
  RegisteredPayload,
  CommandPayload,
  ResultChunkPayload,
  StatusUpdatePayload,
  LoginRequest,
  LoginResponse,
  DeviceResponse,
  SessionResponse,
  SessionInfo,
  CreateUserRequest,
  UserResponse,
  ApiError,
  SessionCreatedPayload,
  DeviceStatusPayload,
  TokenResponse,
  ErrorPayload,
} from '@remote-claude/shared-types';

// Admin-specific types (not in shared-types)
export interface AdminDeviceResponse {
  id: string;
  name: string;
  version: string;
  online: boolean;
  busy: boolean;
  last_seen: number;
  user_id: string;
  registered_at: number;
}

export interface AdminSessionResponse {
  id: string;
  device_id: string;
  user_id: string;
  created_at: number;
  closed: boolean;
  active: boolean;
  cwd: string | null;
}

export interface SessionDetailResponse extends AdminSessionResponse {
  history: string | null;
}

export interface DownloadFileInfo {
  filename: string;
  size: number;
  modified: string;
  platform: string | null;
  arch: string | null;
  version: string | null;
}
