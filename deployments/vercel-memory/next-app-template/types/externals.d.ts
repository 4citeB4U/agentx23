// LEEWAY HEADER BLOCK
// File: deployments/vercel-memory/next-app-template/types/externals.d.ts
// Purpose: Local template type stubs so workspace diagnostics stay clean before copy-out
// Security: LEEWAY-CORE-2026 compliant
// Performance: No runtime impact; declaration-only compatibility layer

declare module "@vercel/postgres" {
  export const sql: any;
}

declare module "next/server" {
  export class NextResponse {
    static json(body: any, init?: any): any;
  }
}
