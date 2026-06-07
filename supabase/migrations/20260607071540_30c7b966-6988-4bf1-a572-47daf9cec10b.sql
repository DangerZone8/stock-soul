
-- =========================================================
-- 1) Tournament entries: kill direct INSERT, tighten SELECT
-- =========================================================
DROP POLICY IF EXISTS "join self" ON public.tournament_entries;
DROP POLICY IF EXISTS "view entries" ON public.tournament_entries;

REVOKE INSERT, UPDATE, DELETE ON public.tournament_entries FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.tournament_entries TO authenticated;
GRANT ALL ON public.tournament_entries TO service_role;

CREATE POLICY "view own entry"
  ON public.tournament_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 2) Weekly entries: SELECT own only
-- =========================================================
DROP POLICY IF EXISTS "weekly_entries_select_all" ON public.weekly_entries;
CREATE POLICY "view own weekly entry"
  ON public.weekly_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.weekly_entries FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.weekly_entries TO service_role;

-- =========================================================
-- 3) Copy trade: require server-side price verification
--    Drop direct-callable copy_trade, add internal variant
--    only service_role can invoke.
-- =========================================================
DROP FUNCTION IF EXISTS public.copy_trade(uuid, numeric);

CREATE OR REPLACE FUNCTION public.copy_trade_internal(p_user uuid, p_source uuid, p_price numeric)
RETURNS TABLE(success boolean, coins numeric, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src public.transactions%ROWTYPE;
  cs  public.copy_settings%ROWTYPE;
  v_currency text; v_qty numeric; v_cost numeric; v_max numeric;
  r RECORD; v_last_pnl numeric;
  v_orig_uid uuid;
BEGIN
  IF p_user IS NULL THEN RETURN QUERY SELECT FALSE,0::numeric,'No user'::text; RETURN; END IF;
  IF p_price IS NULL OR p_price <= 0 THEN RETURN QUERY SELECT FALSE,0::numeric,'Bad price'::text; RETURN; END IF;

  SELECT * INTO src FROM public.transactions WHERE id = p_source;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE,0::numeric,'Trade not found'::text; RETURN; END IF;

  SELECT * INTO cs FROM public.copy_settings WHERE user_id=p_user AND leader_id=src.user_id;
  IF NOT FOUND OR NOT cs.active THEN
    RETURN QUERY SELECT FALSE,0::numeric,'Not copying this trader'::text; RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM public.transactions WHERE user_id=p_user AND source_trade_id=p_source) THEN
    RETURN QUERY SELECT FALSE,0::numeric,'Already copied'::text; RETURN;
  END IF;
  IF cs.realized_loss >= (cs.stop_loss_pct/100.0) * cs.max_coins_per_trade * 10 THEN
    RETURN QUERY SELECT FALSE,0::numeric,'Stop-loss reached for this leader'::text; RETURN;
  END IF;

  SELECT currency INTO v_currency FROM public.holdings WHERE user_id=src.user_id AND symbol=src.symbol LIMIT 1;
  v_currency := COALESCE(v_currency,'USD');
  v_qty := src.quantity;
  v_max := cs.max_coins_per_trade;
  IF src.type='buy' THEN
    v_cost := v_qty * p_price;
    IF v_cost > v_max THEN
      v_qty := v_max / p_price;
    END IF;
    IF v_qty <= 0 THEN RETURN QUERY SELECT FALSE,0::numeric,'Quantity too small'::text; RETURN; END IF;
  END IF;

  -- execute_trade depends on auth.uid(); temporarily set the session role context
  -- via a SET LOCAL is not enough — easier path: call execute_trade body inline.
  -- Simpler: set a per-tx GUC and rely on a helper, but cleanest is to inline
  -- the trade using p_user directly.
  DECLARE
    v_coins NUMERIC; v_hold_id UUID; v_hold_qty NUMERIC; v_hold_avg NUMERIC;
    cost NUMERIC; proceeds NUMERIC; pnl NUMERIC; new_qty NUMERIC; new_avg NUMERIC;
  BEGIN
    SELECT p.coins INTO v_coins FROM public.profiles p WHERE p.id = p_user FOR UPDATE;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Profile missing'::TEXT; RETURN; END IF;

    SELECT h.id, h.quantity, h.avg_buy_price INTO v_hold_id, v_hold_qty, v_hold_avg
    FROM public.holdings h WHERE h.user_id = p_user AND h.symbol = src.symbol FOR UPDATE;

    IF src.type = 'buy' THEN
      cost := v_qty * p_price;
      IF v_coins < cost THEN RETURN QUERY SELECT FALSE, v_coins, 'Not enough coins'::TEXT; RETURN; END IF;
      IF v_hold_id IS NOT NULL THEN
        new_qty := v_hold_qty + v_qty;
        new_avg := ((v_hold_qty * v_hold_avg) + cost) / new_qty;
        UPDATE public.holdings SET quantity = new_qty, avg_buy_price = new_avg, currency = v_currency WHERE id = v_hold_id;
      ELSE
        INSERT INTO public.holdings (user_id, symbol, currency, quantity, avg_buy_price)
          VALUES (p_user, src.symbol, v_currency, v_qty, p_price);
      END IF;
      UPDATE public.profiles SET coins = coins - cost WHERE id = p_user RETURNING coins INTO v_coins;
      INSERT INTO public.transactions (user_id, symbol, type, quantity, price, coins_delta, pnl, source_trade_id, copied_from_user)
        VALUES (p_user, src.symbol, 'buy', v_qty, p_price, -cost, 0, src.id, src.user_id);
      RETURN QUERY SELECT TRUE, v_coins, ('Copied buy ' || src.symbol)::TEXT;
    ELSE
      IF v_hold_id IS NULL OR v_hold_qty <= 0 THEN
        RETURN QUERY SELECT FALSE, v_coins, 'No holdings to sell'::TEXT; RETURN;
      END IF;
      v_qty := LEAST(v_qty, v_hold_qty);
      proceeds := v_qty * p_price;
      pnl := (p_price - v_hold_avg) * v_qty;
      new_qty := v_hold_qty - v_qty;
      IF new_qty <= 0 THEN DELETE FROM public.holdings WHERE id = v_hold_id;
      ELSE UPDATE public.holdings SET quantity = new_qty WHERE id = v_hold_id; END IF;
      UPDATE public.profiles SET coins = coins + proceeds, net_profit = net_profit + pnl
        WHERE id = p_user RETURNING coins INTO v_coins;
      INSERT INTO public.transactions (user_id, symbol, type, quantity, price, coins_delta, pnl, source_trade_id, copied_from_user)
        VALUES (p_user, src.symbol, 'sell', v_qty, p_price, proceeds, pnl, src.id, src.user_id);
      IF pnl < 0 THEN
        UPDATE public.copy_settings SET realized_loss = realized_loss + ABS(pnl)
          WHERE user_id = p_user AND leader_id = src.user_id;
      END IF;
      RETURN QUERY SELECT TRUE, v_coins,
        CASE WHEN pnl >= 0 THEN ('Copied sell — profit +' || round(pnl,2)::TEXT) ELSE ('Copied sell — loss ' || round(pnl,2)::TEXT) END;
    END IF;
  END;
END $$;

-- Server-only
REVOKE ALL ON FUNCTION public.copy_trade_internal(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_trade_internal(uuid, uuid, numeric) TO service_role;

-- =========================================================
-- 4) User roles table + is_admin() rewrite
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL  ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view own roles" ON public.user_roles;
CREATE POLICY "view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- Seed existing admin from auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE email = 'rudra.shailendra1@gmail.com'
ON CONFLICT DO NOTHING;

-- =========================================================
-- 5) Pin search_path on remaining mutable functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.compute_league(p_net_profit numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_net_profit >= 25000 THEN 'Titan'
    WHEN p_net_profit >= 5000  THEN 'Whale'
    WHEN p_net_profit >= 1000  THEN 'Shark'
    WHEN p_net_profit >= 100   THEN 'Trader'
    ELSE 'Rookie'
  END;
$$;

CREATE OR REPLACE FUNCTION public.week_monday(d date)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (d - ((EXTRACT(ISODOW FROM d)::int - 1)))::date;
$$;
