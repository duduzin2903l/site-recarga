// Tracking events — no-op stub. The original project posted to a third-party
// Supabase project; here we just log to console for parity without leaking
// foreign credentials.
export const trackEvent = async (eventName: string, data: Record<string, unknown>) => {
  try {
    if (typeof window !== "undefined") {
      console.debug("[trackEvent]", eventName, data);
    }
  } catch {
    /* noop */
  }
};
