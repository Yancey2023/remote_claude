import { getConfig } from '../config';

type MessageHandler = (data: Record<string, unknown>) => void;
type StatusHandler = (connected: boolean) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private handlers = new Map<string, Set<MessageHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private closed = false;

  constructor(url: string, token: string) {
    const cfg = getConfig();
    this.url = url;
    this.token = token;
    this.reconnectDelay = cfg.wsReconnectDelayMs;
    this.maxReconnectDelay = cfg.wsMaxReconnectDelayMs;
  }

  connect() {
    this.closed = false;
    this.doConnect();
  }

  private doConnect() {
    if (this.closed) return;

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = getConfig().wsReconnectDelayMs;
      this.notifyStatus(true);

      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        payload: { token: this.token },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const type = msg.type as string;
        const payload = msg.payload as Record<string, unknown>;
        const handlers = this.handlers.get(type);
        if (handlers) {
          handlers.forEach((h) => h(payload));
        }
      } catch (e) {
        console.error('failed to parse ws message:', e);
      }
    };

    ws.onclose = () => {
      this.notifyStatus(false);
      this.scheduleReconnect();
    };

    ws.onerror = (e) => {
      console.error('ws error:', e);
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    setTimeout(() => {
      this.doConnect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  disconnect() {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }

  send(type: string, payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private notifyStatus(connected: boolean) {
    this.statusHandlers.forEach((h) => h(connected));
  }
}
