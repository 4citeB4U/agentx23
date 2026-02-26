// Declared minimal shims for third-party modules without type declarations
declare module "dotenv";
declare module "@insforge/sdk";
declare module "screenshot-desktop";
declare module "node-pty";
declare module "http-proxy-middleware";
declare module "multer";
declare module "ws";
declare module "ssh2";
declare module "@google/generative-ai";

// allow imports of JSON without explicit types
declare module "*.json" {
  const value: any;
  export default value;
}
