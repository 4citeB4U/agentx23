import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../");

export const CONFIG = {
  DOTENV_PATH: path.join(ROOT, ".env.local"),
  NPM_CMD: "npm.cmd",
  NODE_EXE: "node.exe",
  STITCH_PATH: path.join(ROOT, "workspace/preview") // Refers to the likely location of stitch projects
};
