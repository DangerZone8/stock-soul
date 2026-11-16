type MarketDataEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PROJECT_ID?: string;
};

const buildBaseUrl = (env: MarketDataEnv): string => {
  const configuredUrl = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (configuredUrl) return configuredUrl;
  const projectId = env.VITE_SUPABASE_PROJECT_ID?.trim();
  return projectId ? `https://${projectId}.supabase.co` : "";
};

/**
 * Build a Supabase Edge Function URL from the canonical project URL.
 * The project-ID fallback keeps older Lovable environments compatible.
 */
export const marketFunctionUrl = (
  functionName: string,
  env: MarketDataEnv = import.meta.env,
): string => {
  if (!/^[a-z0-9-]+$/i.test(functionName)) {
    throw new Error("Invalid market function name.");
  }

  const baseUrl = buildBaseUrl(env);
  if (!baseUrl) {
    throw new Error("Market data is not configured. Set VITE_SUPABASE_URL in the deployment environment.");
  }
  return `${baseUrl}/functions/v1/${functionName}`;
};
