import DodoPayments from 'dodopayments';

let dodoClient: DodoPayments | null = null;

export function getDodoPayments(): DodoPayments {
  if (!dodoClient) {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) {
      throw new Error("DODO_PAYMENTS_API_KEY environment variable is missing.");
    }
    const mode = process.env.DODO_PAYMENTS_MODE || "test_mode";
    dodoClient = new DodoPayments({
      bearerToken: apiKey,
      environment: mode === "live" || mode === "live_mode" ? "live_mode" : "test_mode",
    });
  }
  return dodoClient;
}
