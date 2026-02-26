// Declared minimal shims for third-party modules without type declarations
// Detailed shims for modules that CI's TypeScript environment may not have typings for.
declare module "dotenv" {
  const config: { parsed?: Record<string, string> } | (() => void);
  export = config;
}

declare module "@insforge/sdk" {
  const anyExport: any;
  export = anyExport;
}

declare module "screenshot-desktop" {
  const fn: (...args: any[]) => Promise<any>;
  export = fn;
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
  const anyExport: any;
  export = anyExport;
}

declare module "multer" {
  const anyExport: any;
  export = anyExport;
}

declare module "ws" {
  export const OPEN: number;
  export class WebSocket {
    constructor(...args: any[]);
    on(event: string, cb: (...args: any[]) => void): void;
    send(...args: any[]): void;
    close(code?: number, reason?: string): void;
    readyState?: number;
  }
  export class WebSocketServer {
    constructor(opts?: any);
    on(event: string, cb: (...args: any[]) => void): void;
  }
}

declare module "ssh2" {
  export class Client {
    on(event: string, cb: (...args: any[]) => void): this;
    connect(cfg: any): void;
  }
  export type ConnectConfig = any;
  export type Channel = any;
}

declare module "@google/generative-ai" {
  const anyExport: any;
  export = anyExport;
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
