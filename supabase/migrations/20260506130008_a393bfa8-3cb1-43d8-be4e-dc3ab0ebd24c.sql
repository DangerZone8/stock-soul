
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_daily_reward() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execute_trade(TEXT, TEXT, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_trade(TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
