// Declared minimal shims for third-party modules without type declarations
// Detailed shims for modules that CI's TypeScript environment may not have typings for.
declare module "dotenv" {
  export function config(
    opts?: { path?: string } & Record<string, any>,
  ): { parsed?: Record<string, string> } | void;
  const _default: { config: typeof config };
  export default _default;
}

declare module "@insforge/sdk" {
  export function createClient(...args: any[]): any;
  const _default: any;
  export default _default;
}

declare module "screenshot-desktop" {
  function screenshot(...args: any[]): Promise<any>;
  namespace screenshot {
    function listDisplays(): Promise<any[]>;
  }
  export = screenshot;
}

declare module "node-pty" {
  export interface IPty {
    onData(fn: (data: string) => void): void;
    onExit(fn: () => void): void;
    write(data: string): void;
    kill(): void;
    resize(cols: number, rows: number): void;
    pid: number;
    process: string;
    cols: number;
    rows: number;
    read?: () => void;
  }
  export function spawn(shell: string, args: string[], opts?: any): IPty;
}

declare module "http-proxy-middleware" {
  export function createProxyMiddleware(...args: any[]): any;
  const anyExport: any;
  export default anyExport;
}

declare module "multer" {
  const anyExport: any;
  export = anyExport;
}

declare module "ws" {
  export class WebSocket {
    static OPEN: number;
    constructor(...args: any[]);
    on(event: string, cb: (...args: any[]) => void): void;
    send(...args: any[]): void;
    close(code?: number, reason?: string): void;
    readyState?: number;
  }
  export class WebSocketServer {
    constructor(opts?: any);
    on(event: string, cb: (...args: any[]) => void): void;
    handleUpgrade?(
      req: any,
      socket: any,
      head: any,
      cb: (ws: WebSocket) => void,
    ): void;
    emit?(event: string, ...args: any[]): boolean;
    clients?: Set<WebSocket>;
  }
  export const OPEN: number;
}

declare module "ssh2" {
  export class Client {
    on(event: string, cb: (...args: any[]) => void): this;
    connect(cfg: any): void;
    end?(): void;
    shell?(cb?: (err: any, stream?: any) => void): void;
  }
  export type ConnectConfig = any;
  export type Channel = any;
}

declare module "@google/generative-ai" {
  export const GoogleGenerativeAI: any;
  const anyExport: any;
  export default anyExport;
}

declare module "uuid" {
  export function v4(): string;
  export function v1(): string;
  const anyExport: any;
  export default anyExport;
}

// Provide a minimal RateLimitDecision shape used by security service
declare interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs?: number;
  windowMs?: number;
  limit?: number;
}

// Extend Express Request to allow `file` injected by multer
declare global {
  namespace Express {
    interface Request {
      file?: any;
      files?: any;
    }
  }
}

// allow imports of JSON without explicit types
declare module "*.json" {
  const value: any;
  export default value;
}

// allow imports of JSON without explicit types
declare module "*.json" {
  const value: any;
  export default value;
}
