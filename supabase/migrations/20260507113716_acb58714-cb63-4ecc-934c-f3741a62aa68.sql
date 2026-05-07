-- Add username, referral, net_profit
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID,
  ADD COLUMN IF NOT EXISTS net_profit NUMERIC NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code);

-- Backfill referral codes for existing users
UPDATE public.profiles
  SET referral_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
  WHERE referral_code IS NULL;

-- Update handle_new_user to set username + referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username TEXT;
  v_code TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  INSERT INTO public.profiles (id, email, display_name, username, referral_code, coins)
  VALUES (NEW.id, NEW.email, v_username, v_username, v_code, 100)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Leaderboard RPC (security definer, exposes only safe fields)
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_kind TEXT DEFAULT 'coins', p_limit INT DEFAULT 25)
RETURNS TABLE(rank BIGINT, user_id UUID, username TEXT, coins NUMERIC, net_profit NUMERIC)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY
      CASE WHEN p_kind = 'profit' THEN p.net_profit ELSE p.coins END DESC) AS rank,
    p.id AS user_id,
    COALESCE(p.username, p.display_name, 'Trader') AS username,
    p.coins,
    p.net_profit
  FROM public.profiles p
  ORDER BY
    CASE WHEN p_kind = 'profit' THEN p.net_profit ELSE p.coins END DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, INT) TO anon, authenticated;

-- Redeem referral
CREATE OR REPLACE FUNCTION public.redeem_referral(p_code TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  v_referrer UUID;
  v_already UUID;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN; END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN QUERY SELECT FALSE, 'Enter a code'::TEXT; RETURN;
  END IF;

  SELECT referred_by INTO v_already FROM public.profiles WHERE id = uid;
  IF v_already IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Already used a referral'::TEXT; RETURN;
  END IF;

  SELECT id INTO v_referrer FROM public.profiles
    WHERE upper(referral_code) = upper(trim(p_code)) LIMIT 1;
  IF v_referrer IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid code'::TEXT; RETURN;
  END IF;
  IF v_referrer = uid THEN
    RETURN QUERY SELECT FALSE, 'Cannot refer yourself'::TEXT; RETURN;
  END IF;

  UPDATE public.profiles SET referred_by = v_referrer, coins = coins + 25 WHERE id = uid;
  UPDATE public.profiles SET coins = coins + 50 WHERE id = v_referrer;
  RETURN QUERY SELECT TRUE, 'Referral applied! +25 coins for you, +50 for your friend'::TEXT;
END; $$;

GRANT EXECUTE ON FUNCTION public.redeem_referral(TEXT) TO authenticated;

-- Update execute_trade to track net_profit on sells
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
    IF new_qty <= 0 THEN DELETE FROM public.holdings WHERE id = v_hold_id;
    ELSE UPDATE public.holdings SET quantity = new_qty WHERE id = v_hold_id;
    END IF;
    UPDATE public.profiles
      SET coins = public.profiles.coins + proceeds,
          net_profit = public.profiles.net_profit + pnl
      WHERE id = uid
      RETURNING public.profiles.coins INTO v_coins;
    INSERT INTO public.transactions (user_id, symbol, type, quantity, price, coins_delta)
      VALUES (uid, p_symbol, 'sell', p_quantity, p_price, proceeds);
    RETURN QUERY SELECT TRUE, v_coins,
      CASE WHEN pnl >= 0 THEN ('Profit +' || round(pnl, 2)::TEXT || ' coins') ELSE ('Loss ' || round(pnl, 2)::TEXT || ' coins') END;
  END IF;
END; $function$;