
DROP FUNCTION IF EXISTS public.claim_daily_reward();

CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS TABLE(claimed boolean, coins numeric, message text, streak integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_last DATE; v_coins NUMERIC; v_streak INTEGER; v_longest INTEGER;
  v_reward NUMERIC; v_bonus TEXT := '';
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Not authenticated'::TEXT, 0; RETURN; END IF;
  SELECT p.last_reward_date, p.coins, p.current_streak, p.longest_streak
    INTO v_last, v_coins, v_streak, v_longest
    FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, coins, last_reward_date, current_streak, longest_streak)
      VALUES (uid, 1250, CURRENT_DATE, 1, 1)
      RETURNING public.profiles.coins, public.profiles.current_streak INTO v_coins, v_streak;
    RETURN QUERY SELECT TRUE, v_coins, 'Welcome! +250 coins (Day 1 streak)'::TEXT, v_streak; RETURN;
  END IF;
  IF v_last = CURRENT_DATE THEN
    RETURN QUERY SELECT FALSE, v_coins, 'Already claimed today'::TEXT, v_streak; RETURN;
  END IF;
  IF v_last = CURRENT_DATE - 1 THEN v_streak := v_streak + 1; ELSE v_streak := 1; END IF;
  v_longest := GREATEST(COALESCE(v_longest,0), v_streak);
  v_reward := 250 + LEAST(250, (v_streak - 1) * 25);
  IF v_streak >= 7 THEN v_bonus := ' 🔥'; END IF;
  UPDATE public.profiles
    SET coins = public.profiles.coins + v_reward,
        last_reward_date = CURRENT_DATE,
        current_streak = v_streak,
        longest_streak = v_longest
    WHERE id = uid RETURNING public.profiles.coins INTO v_coins;
  RETURN QUERY SELECT TRUE, v_coins,
    ('+' || v_reward::TEXT || ' coins (Day ' || v_streak::TEXT || ' streak)' || v_bonus)::TEXT,
    v_streak;
END $$;
