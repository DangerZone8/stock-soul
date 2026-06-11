
-- Tighten profile column access so emails are not publicly readable
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, display_name, username, coins, net_profit, referral_code, referred_by, last_reward_date, created_at, updated_at, username_changes)
  ON public.profiles TO anon;

GRANT SELECT (id, display_name, username, coins, net_profit, referral_code, referred_by, last_reward_date, created_at, updated_at, username_changes, email)
  ON public.profiles TO authenticated;

-- Owners still need INSERT/UPDATE on their own row (RLS already restricts to auth.uid()=id)
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
