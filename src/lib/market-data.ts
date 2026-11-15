const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\\/+$/, "");
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

/**
 * Build a Supabase Edge Function URL from the canonical project URL.
 * The project-ID fallback keeps older Lovable environments compatible.
 */
export const marketFunctionUrl = (functionName: string): string => {
  const baseUrl = SUPABASE_URL || (SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : "");
  if (!baseUrl) {
    throw new Error("Market data is not configured. Set VITE_SUPABASE_URL in the deployment environment.");
  }
  return `${baseUrl}/functions/v1/${functionName}`;
};
