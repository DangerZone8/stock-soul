CREATE OR REPLACE FUNCTION public.execute_trade(p_symbol text, p_currency text, p_type text, p_quantity numeric, p_price numeric)
 RETURNS TABLE(success boolean, coins numeric, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  v_coins NUMERIC;
  v_hold_id UUID;
  v_hold_qty NUMERIC;
  v_hold_avg NUMERIC;
  cost NUMERIC;
  proceeds NUMERIC;
  pnl NUMERIC;
  new_qty NUMERIC;
  new_avg NUMERIC;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Not authenticated'::TEXT; RETURN; END IF;
  IF p_quantity <= 0 OR p_price <= 0 THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Invalid trade'::TEXT; RETURN; END IF;
  IF p_type NOT IN ('buy','sell') THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Invalid type'::TEXT; RETURN; END IF;

  SELECT p.coins INTO v_coins FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, coins) VALUES (uid, 100)
      ON CONFLICT (id) DO NOTHING;
    SELECT p.coins INTO v_coins FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  END IF;

  SELECT h.id, h.quantity, h.avg_buy_price
    INTO v_hold_id, v_hold_qty, v_hold_avg
  FROM public.holdings h
  WHERE h.user_id = uid AND h.symbol = p_symbol
  FOR UPDATE;

  IF p_type = 'buy' THEN
    cost := p_quantity * p_price;
    IF v_coins < cost THEN
      RETURN QUERY SELECT FALSE, v_coins, 'Not enough coins'::TEXT; RETURN;
    END IF;
    IF v_hold_id IS NOT NULL THEN
      new_qty := v_hold_qty + p_quantity;
      new_avg := ((v_hold_qty * v_hold_avg) + cost) / new_qty;
      UPDATE public.holdings
        SET quantity = new_qty, avg_buy_price = new_avg, currency = p_currency
        WHERE id = v_hold_id;
    ELSE
      INSERT INTO public.holdings (user_id, symbol, currency, quantity, avg_buy_price)
        VALUES (uid, p_symbol, p_currency, p_quantity, p_price);
    END IF;
    UPDATE public.profiles
      SET coins = public.profiles.coins - cost
      WHERE id = uid
      RETURNING public.profiles.coins INTO v_coins;
    INSERT INTO public.transactions (user_id, symbol, type, quantity, price, coins_delta)
      VALUES (uid, p_symbol, 'buy', p_quantity, p_price, -cost);
    RETURN QUERY SELECT TRUE, v_coins, ('Bought ' || p_quantity::TEXT || ' ' || p_symbol)::TEXT;
  ELSE
    IF v_hold_id IS NULL OR v_hold_qty < p_quantity THEN
      RETURN QUERY SELECT FALSE, v_coins, 'Not enough holdings'::TEXT; RETURN;
    END IF;
    proceeds := p_quantity * p_price;
    pnl := (p_price - v_hold_avg) * p_quantity;
    new_qty := v_hold_qty - p_quantity;
    IF new_qty <= 0 THEN
      DELETE FROM public.holdings WHERE id = v_hold_id;
    ELSE
      UPDATE public.holdings SET quantity = new_qty WHERE id = v_hold_id;
    END IF;
    UPDATE public.profiles
      SET coins = public.profiles.coins + proceeds
      WHERE id = uid
      RETURNING public.profiles.coins INTO v_coins;
    INSERT INTO public.transactions (user_id, symbol, type, quantity, price, coins_delta)
      VALUES (uid, p_symbol, 'sell', p_quantity, p_price, proceeds);
    RETURN QUERY SELECT TRUE, v_coins,
      CASE WHEN pnl >= 0 THEN ('Profit +' || round(pnl, 2)::TEXT || ' coins') ELSE ('Loss ' || round(pnl, 2)::TEXT || ' coins') END;
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_daily_reward()
 RETURNS TABLE(claimed boolean, coins numeric, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  v_last DATE;
  v_coins NUMERIC;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Not authenticated'::TEXT; RETURN;
  END IF;
  SELECT p.last_reward_date, p.coins INTO v_last, v_coins
    FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, coins, last_reward_date) VALUES (uid, 150, CURRENT_DATE)
      RETURNING public.profiles.coins INTO v_coins;
    RETURN QUERY SELECT TRUE, v_coins, 'Welcome! +50 daily reward'::TEXT; RETURN;
  END IF;
  IF v_last IS DISTINCT FROM CURRENT_DATE THEN
    UPDATE public.profiles
      SET coins = public.profiles.coins + 50, last_reward_date = CURRENT_DATE
      WHERE id = uid
      RETURNING public.profiles.coins INTO v_coins;
    RETURN QUERY SELECT TRUE, v_coins, '+50 coins daily reward!'::TEXT; RETURN;
  END IF;
  RETURN QUERY SELECT FALSE, v_coins, 'Already claimed today'::TEXT;
END; $function$;