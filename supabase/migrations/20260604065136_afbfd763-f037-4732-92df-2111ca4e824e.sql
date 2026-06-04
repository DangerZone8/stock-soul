
-- 1. Fix ambiguous column in change_username (OUT param `username` collided with table column)
CREATE OR REPLACE FUNCTION public.change_username(p_new text)
 RETURNS TABLE(success boolean, message text, username text, remaining integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_count INTEGER;
  v_clean TEXT;
  v_taken UUID;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT, NULL::TEXT, 0; RETURN; END IF;
  v_clean := trim(p_new);
  IF length(v_clean) < 3 OR length(v_clean) > 24 THEN
    RETURN QUERY SELECT FALSE, 'Username must be 3-24 chars'::TEXT, NULL::TEXT, 0; RETURN;
  END IF;
  IF v_clean !~ '^[A-Za-z0-9_]+$' THEN
    RETURN QUERY SELECT FALSE, 'Letters, numbers, underscore only'::TEXT, NULL::TEXT, 0; RETURN;
  END IF;
  SELECT p.username_changes INTO v_count FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  IF v_count >= 5 THEN
    RETURN QUERY SELECT FALSE, 'Max 5 username changes reached'::TEXT, NULL::TEXT, 0; RETURN;
  END IF;
  SELECT p.id INTO v_taken FROM public.profiles p WHERE lower(p.username) = lower(v_clean) AND p.id <> uid LIMIT 1;
  IF v_taken IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Username already taken'::TEXT, NULL::TEXT, (5 - v_count); RETURN;
  END IF;
  UPDATE public.profiles SET username = v_clean, username_changes = username_changes + 1, display_name = v_clean WHERE id = uid;
  RETURN QUERY SELECT TRUE, 'Username updated'::TEXT, v_clean, (5 - v_count - 1);
END; $$;

-- 2. Add pnl column to transactions for win-rate tracking
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS pnl numeric NOT NULL DEFAULT 0;

-- 3. Update execute_trade to record pnl
CREATE OR REPLACE FUNCTION public.execute_trade(p_symbol text, p_currency text, p_type text, p_quantity numeric, p_price numeric)
 RETURNS TABLE(success boolean, coins numeric, message text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_coins NUMERIC; v_hold_id UUID; v_hold_qty NUMERIC; v_hold_avg NUMERIC;
  cost NUMERIC; proceeds NUMERIC; pnl NUMERIC; new_qty NUMERIC; new_avg NUMERIC;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Not authenticated'::TEXT; RETURN; END IF;
  IF p_quantity <= 0 OR p_price <= 0 THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Invalid trade'::TEXT; RETURN; END IF;
  IF p_type NOT IN ('buy','sell') THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Invalid type'::TEXT; RETURN; END IF;

  SELECT p.coins INTO v_coins FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, coins) VALUES (uid, 100) ON CONFLICT (id) DO NOTHING;
    SELECT p.coins INTO v_coins FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  END IF;

  SELECT h.id, h.quantity, h.avg_buy_price INTO v_hold_id, v_hold_qty, v_hold_avg
  FROM public.holdings h WHERE h.user_id = uid AND h.symbol = p_symbol FOR UPDATE;

  IF p_type = 'buy' THEN
    cost := p_quantity * p_price;
    IF v_coins < cost THEN RETURN QUERY SELECT FALSE, v_coins, 'Not enough coins'::TEXT; RETURN; END IF;
    IF v_hold_id IS NOT NULL THEN
      new_qty := v_hold_qty + p_quantity;
      new_avg := ((v_hold_qty * v_hold_avg) + cost) / new_qty;
      UPDATE public.holdings SET quantity = new_qty, avg_buy_price = new_avg, currency = p_currency WHERE id = v_hold_id;
    ELSE
      INSERT INTO public.holdings (user_id, symbol, currency, quantity, avg_buy_price)
        VALUES (uid, p_symbol, p_currency, p_quantity, p_price);
    END IF;
    UPDATE public.profiles SET coins = public.profiles.coins - cost WHERE id = uid RETURNING public.profiles.coins INTO v_coins;
    INSERT INTO public.transactions (user_id, symbol, type, quantity, price, coins_delta, pnl)
      VALUES (uid, p_symbol, 'buy', p_quantity, p_price, -cost, 0);
    RETURN QUERY SELECT TRUE, v_coins, ('Bought ' || p_quantity::TEXT || ' ' || p_symbol)::TEXT;
  ELSE
    IF v_hold_id IS NULL OR v_hold_qty < p_quantity THEN
      RETURN QUERY SELECT FALSE, v_coins, 'Not enough holdings'::TEXT; RETURN;
    END IF;
    proceeds := p_quantity * p_price;
    pnl := (p_price - v_hold_avg) * p_quantity;
    new_qty := v_hold_qty - p_quantity;
    IF new_qty <= 0 THEN DELETE FROM public.holdings WHERE id = v_hold_id;
    ELSE UPDATE public.holdings SET quantity = new_qty WHERE id = v_hold_id;
    END IF;
    UPDATE public.profiles
      SET coins = public.profiles.coins + proceeds,
          net_profit = public.profiles.net_profit + pnl
      WHERE id = uid
      RETURNING public.profiles.coins INTO v_coins;
    INSERT INTO public.transactions (user_id, symbol, type, quantity, price, coins_delta, pnl)
      VALUES (uid, p_symbol, 'sell', p_quantity, p_price, proceeds, pnl);
    RETURN QUERY SELECT TRUE, v_coins,
      CASE WHEN pnl >= 0 THEN ('Profit +' || round(pnl, 2)::TEXT || ' coins') ELSE ('Loss ' || round(pnl, 2)::TEXT || ' coins') END;
  END IF;
END; $$;

-- 4. League helper
CREATE OR REPLACE FUNCTION public.compute_league(p_net_profit numeric)
 RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_net_profit >= 25000 THEN 'Titan'
    WHEN p_net_profit >= 5000  THEN 'Whale'
    WHEN p_net_profit >= 1000  THEN 'Shark'
    WHEN p_net_profit >= 100   THEN 'Trader'
    ELSE 'Rookie'
  END;
$$;

-- 5. Personalized stats (combines stock + forex — all live in transactions/holdings)
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user uuid DEFAULT NULL)
 RETURNS TABLE(
   joined_at timestamptz, username text, coins numeric, net_profit numeric,
   portfolio_value numeric, total_trades bigint, total_buys bigint, total_sells bigint,
   wins bigint, losses bigint, win_rate numeric, holdings_count bigint, league text
 ) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := COALESCE(p_user, auth.uid());
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH p AS (SELECT * FROM public.profiles WHERE id = uid),
  h AS (SELECT COALESCE(SUM(quantity * avg_buy_price),0) AS pv, COUNT(*) AS c FROM public.holdings WHERE user_id = uid),
  t AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE type='buy') AS buys,
      COUNT(*) FILTER (WHERE type='sell') AS sells,
      COUNT(*) FILTER (WHERE type='sell' AND pnl > 0) AS wins,
      COUNT(*) FILTER (WHERE type='sell' AND pnl < 0) AS losses
    FROM public.transactions WHERE user_id = uid
  )
  SELECT p.created_at, COALESCE(p.username, p.display_name, 'Trader'),
    p.coins, p.net_profit, h.pv, t.total, t.buys, t.sells, t.wins, t.losses,
    CASE WHEN (t.wins + t.losses) > 0 THEN ROUND(100.0 * t.wins / (t.wins + t.losses), 1) ELSE 0 END,
    h.c, public.compute_league(p.net_profit)
  FROM p, h, t;
END; $$;

-- 6. Weekly winners table
CREATE TABLE IF NOT EXISTS public.weekly_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  coins_earned numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.weekly_winners TO anon, authenticated;
GRANT ALL ON public.weekly_winners TO service_role;
ALTER TABLE public.weekly_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view weekly winners" ON public.weekly_winners FOR SELECT USING (true);

-- 7. Helper: Monday of a given date (week_start)
CREATE OR REPLACE FUNCTION public.week_monday(d date) RETURNS date
 LANGUAGE sql IMMUTABLE AS $$
  SELECT (d - ((EXTRACT(ISODOW FROM d)::int - 1)))::date;
$$;

-- 8. Current-week leaderboard (Mon..Fri end-of-day, combined stock + forex)
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(p_limit integer DEFAULT 10)
 RETURNS TABLE(rank bigint, user_id uuid, username text, coins_earned numeric, trades bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH wk AS (
    SELECT public.week_monday(CURRENT_DATE) AS start_d,
           (public.week_monday(CURRENT_DATE) + INTERVAL '5 days')::date AS end_d
  ),
  agg AS (
    SELECT t.user_id, COALESCE(SUM(t.pnl),0) AS earned, COUNT(*) AS trades
    FROM public.transactions t, wk
    WHERE t.created_at >= wk.start_d
      AND t.created_at <  wk.end_d
      AND t.type = 'sell'
    GROUP BY t.user_id
  )
  SELECT ROW_NUMBER() OVER (ORDER BY a.earned DESC) AS rank,
         a.user_id, COALESCE(p.username, p.display_name, 'Trader'), a.earned, a.trades
  FROM agg a JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.earned DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
$$;

-- 9. Award previous week's winner (idempotent; safe to call on every home page load).
--    Only awards once the week is over (today is Mon-Sun of the FOLLOWING week).
CREATE OR REPLACE FUNCTION public.award_last_week_winner()
 RETURNS TABLE(awarded boolean, username text, coins_earned numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_last_start date := public.week_monday(CURRENT_DATE) - INTERVAL '7 days';
  v_last_end   date := public.week_monday(CURRENT_DATE);
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

-- 10. Latest winner getter
CREATE OR REPLACE FUNCTION public.get_latest_weekly_winner()
 RETURNS TABLE(week_start date, username text, coins_earned numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT week_start, username, coins_earned FROM public.weekly_winners
  ORDER BY week_start DESC LIMIT 1;
$$;
