
-- Weekly challenge entries: users pay 50 coins to opt-in for the current week
CREATE TABLE IF NOT EXISTS public.weekly_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  fee_paid NUMERIC NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT ON public.weekly_entries TO authenticated;
GRANT ALL ON public.weekly_entries TO service_role;

ALTER TABLE public.weekly_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_entries_select_all" ON public.weekly_entries FOR SELECT TO authenticated USING (true);

-- RPC: enter the current week's challenge (deducts 50 coins, idempotent)
CREATE OR REPLACE FUNCTION public.enter_weekly_challenge()
RETURNS TABLE(success boolean, message text, coins numeric, week_start date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_week date := public.week_monday(CURRENT_DATE);
  v_coins numeric;
  v_exists boolean;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT, 0::NUMERIC, v_week; RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.weekly_entries WHERE user_id=uid AND week_start=v_week) INTO v_exists;
  IF v_exists THEN
    SELECT coins INTO v_coins FROM public.profiles WHERE id=uid;
    RETURN QUERY SELECT TRUE, 'Already entered this week'::TEXT, v_coins, v_week; RETURN;
  END IF;
  SELECT coins INTO v_coins FROM public.profiles WHERE id=uid FOR UPDATE;
  IF v_coins < 50 THEN
    RETURN QUERY SELECT FALSE, 'Need 50 coins to enter'::TEXT, v_coins, v_week; RETURN;
  END IF;
  UPDATE public.profiles SET coins = coins - 50 WHERE id = uid RETURNING coins INTO v_coins;
  INSERT INTO public.weekly_entries(user_id, week_start, fee_paid) VALUES (uid, v_week, 50);
  RETURN QUERY SELECT TRUE, 'Entered! Good luck this week.'::TEXT, v_coins, v_week;
END; $$;

-- RPC: check entry status for current user this week
CREATE OR REPLACE FUNCTION public.get_my_weekly_entry()
RETURNS TABLE(entered boolean, week_start date, entrants bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH wk AS (SELECT public.week_monday(CURRENT_DATE) AS w)
  SELECT
    EXISTS(SELECT 1 FROM public.weekly_entries we, wk WHERE we.user_id = auth.uid() AND we.week_start = wk.w),
    (SELECT w FROM wk),
    (SELECT COUNT(*) FROM public.weekly_entries we, wk WHERE we.week_start = wk.w);
$$;

-- Replace leaderboard to only count entered users
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(p_limit integer DEFAULT 10)
RETURNS TABLE(rank bigint, user_id uuid, username text, coins_earned numeric, trades bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH wk AS (
    SELECT public.week_monday(CURRENT_DATE) AS start_d,
           (public.week_monday(CURRENT_DATE) + INTERVAL '5 days')::date AS end_d
  ),
  entrants AS (SELECT user_id FROM public.weekly_entries we, wk WHERE we.week_start = wk.start_d),
  agg AS (
    SELECT t.user_id, COALESCE(SUM(t.pnl),0) AS earned, COUNT(*) AS trades
    FROM public.transactions t, wk
    WHERE t.created_at >= wk.start_d
      AND t.created_at <  wk.end_d
      AND t.type = 'sell'
      AND t.user_id IN (SELECT user_id FROM entrants)
    GROUP BY t.user_id
  )
  SELECT ROW_NUMBER() OVER (ORDER BY a.earned DESC) AS rank,
         a.user_id, COALESCE(p.username, p.display_name, 'Trader'), a.earned, a.trades
  FROM agg a JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.earned DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
$$;

-- Replace winner awarder to only consider entrants of LAST week
CREATE OR REPLACE FUNCTION public.award_last_week_winner()
RETURNS TABLE(awarded boolean, username text, coins_earned numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_last_start date := public.week_monday(CURRENT_DATE) - INTERVAL '7 days';
  v_winner uuid; v_name text; v_earned numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM public.weekly_winners WHERE week_start = v_last_start) THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 0::NUMERIC; RETURN;
  END IF;
  SELECT t.user_id, COALESCE(p.username, p.display_name, 'Trader'), SUM(t.pnl)
  INTO v_winner, v_name, v_earned
  FROM public.transactions t JOIN public.profiles p ON p.id = t.user_id
  WHERE t.created_at >= v_last_start
    AND t.created_at <  (v_last_start + INTERVAL '5 days')
    AND t.type = 'sell'
    AND t.user_id IN (SELECT user_id FROM public.weekly_entries WHERE week_start = v_last_start)
  GROUP BY t.user_id, p.username, p.display_name
  ORDER BY SUM(t.pnl) DESC NULLS LAST
  LIMIT 1;
  IF v_winner IS NULL OR v_earned IS NULL OR v_earned <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 0::NUMERIC; RETURN;
  END IF;
  INSERT INTO public.weekly_winners (week_start, user_id, username, coins_earned)
    VALUES (v_last_start, v_winner, v_name, v_earned)
    ON CONFLICT (week_start) DO NOTHING;
  UPDATE public.profiles SET coins = coins + 250 WHERE id = v_winner;
  RETURN QUERY SELECT TRUE, v_name, v_earned;
END; $$;
