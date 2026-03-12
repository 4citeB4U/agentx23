/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-RUNTIME
TAG: GENESIS.ENGINE.UI.CEREBRAL_CLIENT
REGION: 🔵 UI
============================================================================ */

export interface CerebralResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  checksum?: string;
}

export class CerebralClient {
  private static baseUrl =
    ((import.meta as any).env.VITE_CEREBRAL_BASE_URL as string) ||
    "http://127.0.0.1:8787";

  private static validateAction(action: string, params: any): void {
    const forbidden = ["delete_root", "wipe_snapshots", "disable_guardian"];
    if (forbidden.includes(action)) {
      throw new Error(
        `[Sovereign Block] Action '${action}' violates Core Invariants.`,
      );
    }
    if (!params || typeof params !== "object") {
      throw new Error(
        "[Contract Error] Actions must include a valid parameter payload.",
      );
    }
  }

  static async sendAction<T = any>(
    action: string,
    params: any = {},
  ): Promise<CerebralResponse<T>> {
    try {
      this.validateAction(action, params);

      console.log(`🧠 [Cerebral] Dispatching: ${action}`);
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, "")}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, params }),
        },
      );

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const json = await response.json();
      return json as CerebralResponse<T>;
    } catch (err: any) {
      console.error("🚨 [Cerebral] Action Failed:", err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  }
}
