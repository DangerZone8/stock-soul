
-- ============ COPY TRADING ============
CREATE TABLE IF NOT EXISTS public.copy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leader_id uuid NOT NULL,
  max_coins_per_trade numeric NOT NULL DEFAULT 500,
  stop_loss_pct numeric NOT NULL DEFAULT 20,
  active boolean NOT NULL DEFAULT true,
  realized_loss numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, leader_id),
  CHECK (user_id <> leader_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copy_settings TO authenticated;
GRANT ALL ON public.copy_settings TO service_role;
ALTER TABLE public.copy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own copy settings" ON public.copy_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS copied_from_user uuid;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source_trade_id uuid;

-- ============ TOURNAMENTS ============
DO $$ BEGIN
  CREATE TYPE tournament_market AS ENUM ('stock','forex','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE tournament_kind AS ENUM ('daily','weekly','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  market tournament_market NOT NULL DEFAULT 'both',
  kind tournament_kind NOT NULL DEFAULT 'custom',
  entry_fee numeric NOT NULL DEFAULT 100,
  prize_pool numeric NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid,
  awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournaments TO authenticated, anon;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view tournaments" ON public.tournaments FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  fee_paid numeric NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);
GRANT SELECT, INSERT ON public.tournament_entries TO authenticated;
GRANT ALL ON public.tournament_entries TO service_role;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view entries" ON public.tournament_entries FOR SELECT USING (true);
CREATE POLICY "join self" ON public.tournament_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tournament_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  username text,
  rank int NOT NULL,
  prize numeric NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, rank)
);
GRANT SELECT ON public.tournament_winners TO authenticated, anon;
GRANT ALL ON public.tournament_winners TO service_role;
ALTER TABLE public.tournament_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view winners" ON public.tournament_winners FOR SELECT USING (true);

-- ============ FUNCTIONS ============

-- Copy settings upsert
CREATE OR REPLACE FUNCTION public.set_copy_settings(p_leader uuid, p_max numeric, p_stop_pct numeric, p_active boolean)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE,'Not authenticated'::text; RETURN; END IF;
  IF p_leader = uid THEN RETURN QUERY SELECT FALSE,'Cannot copy yourself'::text; RETURN; END IF;
  INSERT INTO public.copy_settings (user_id, leader_id, max_coins_per_trade, stop_loss_pct, active)
    VALUES (uid, p_leader, GREATEST(10, p_max), GREATEST(1, LEAST(100, p_stop_pct)), p_active)
    ON CONFLICT (user_id, leader_id) DO UPDATE
      SET max_coins_per_trade=EXCLUDED.max_coins_per_trade,
          stop_loss_pct=EXCLUDED.stop_loss_pct,
          active=EXCLUDED.active,
          updated_at=now();
  RETURN QUERY SELECT TRUE,'Copy settings saved'::text;
END $$;

-- List of leaders the current user is copying with settings + leader info
CREATE OR REPLACE FUNCTION public.get_my_copy_leaders()
RETURNS TABLE(leader_id uuid, username text, coins numeric, net_profit numeric,
              max_coins_per_trade numeric, stop_loss_pct numeric, active boolean, realized_loss numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT cs.leader_id,
         COALESCE(p.username, p.display_name, 'Trader'),
         p.coins, p.net_profit,
         cs.max_coins_per_trade, cs.stop_loss_pct, cs.active, cs.realized_loss
  FROM public.copy_settings cs
  JOIN public.profiles p ON p.id = cs.leader_id
  WHERE cs.user_id = auth.uid()
  ORDER BY cs.active DESC, cs.created_at DESC;
$$;

-- Recent trades from leaders the user is actively copying
CREATE OR REPLACE FUNCTION public.get_copy_feed(p_limit int DEFAULT 30)
RETURNS TABLE(trade_id uuid, leader_id uuid, username text, symbol text, type text,
              quantity numeric, price numeric, pnl numeric, created_at timestamptz,
              already_copied boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT t.id, t.user_id,
         COALESCE(p.username, p.display_name,'Trader'),
         t.symbol, t.type, t.quantity, t.price, t.pnl, t.created_at,
         EXISTS(SELECT 1 FROM public.transactions tx
                WHERE tx.user_id = auth.uid() AND tx.source_trade_id = t.id)
  FROM public.transactions t
  JOIN public.profiles p ON p.id = t.user_id
  JOIN public.copy_settings cs ON cs.leader_id = t.user_id AND cs.user_id = auth.uid() AND cs.active = true
  WHERE t.created_at > now() - interval '14 days'
  ORDER BY t.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

-- Copy a trade: clones type/symbol/quantity (capped by max_coins_per_trade) at given price.
CREATE OR REPLACE FUNCTION public.copy_trade(p_source uuid, p_price numeric)
RETURNS TABLE(success boolean, coins numeric, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid();
  src public.transactions%ROWTYPE;
  cs  public.copy_settings%ROWTYPE;
  v_currency text;
  v_qty numeric; v_cost numeric; v_max numeric;
  v_coins numeric;
  r RECORD;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE,0::numeric,'Not authenticated'::text; RETURN; END IF;
  IF p_price IS NULL OR p_price <= 0 THEN RETURN QUERY SELECT FALSE,0::numeric,'Bad price'::text; RETURN; END IF;
  SELECT * INTO src FROM public.transactions WHERE id = p_source;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE,0::numeric,'Trade not found'::text; RETURN; END IF;
  SELECT * INTO cs FROM public.copy_settings WHERE user_id=uid AND leader_id=src.user_id;
  IF NOT FOUND OR NOT cs.active THEN
    RETURN QUERY SELECT FALSE,0::numeric,'Not copying this trader'::text; RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM public.transactions WHERE user_id=uid AND source_trade_id=p_source) THEN
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
      v_cost := v_qty * p_price;
    END IF;
    IF v_qty <= 0 THEN RETURN QUERY SELECT FALSE,0::numeric,'Quantity too small'::text; RETURN; END IF;
  END IF;
  -- delegate to execute_trade by direct insert-style ops (call execute_trade)
  SELECT * INTO r FROM public.execute_trade(src.symbol, v_currency, src.type, v_qty, p_price);
  IF NOT r.success THEN
    RETURN QUERY SELECT FALSE, r.coins, r.message; RETURN;
  END IF;
  -- mark last tx as copied
  UPDATE public.transactions
    SET copied_from_user = src.user_id, source_trade_id = src.id
    WHERE id = (SELECT id FROM public.transactions WHERE user_id=uid ORDER BY created_at DESC LIMIT 1);
  -- track realized loss on sell copies
  IF src.type='sell' THEN
    DECLARE v_last_pnl numeric;
    BEGIN
      SELECT pnl INTO v_last_pnl FROM public.transactions WHERE user_id=uid ORDER BY created_at DESC LIMIT 1;
      IF v_last_pnl < 0 THEN
        UPDATE public.copy_settings SET realized_loss = realized_loss + ABS(v_last_pnl)
          WHERE user_id=uid AND leader_id=src.user_id;
      END IF;
    END;
  END IF;
  RETURN QUERY SELECT TRUE, r.coins, ('Copied: '||r.message)::text;
END $$;

-- ============ TOURNAMENT RPCs ============
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((auth.jwt() ->> 'email') = 'rudra.shailendra1@gmail.com', false);
$$;

CREATE OR REPLACE FUNCTION public.create_tournament(
  p_name text, p_market tournament_market, p_entry_fee numeric,
  p_prize_pool numeric, p_starts_at timestamptz, p_ends_at timestamptz,
  p_kind tournament_kind DEFAULT 'custom'
) RETURNS TABLE(success boolean, message text, id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE, 'Admin only'::text, NULL::uuid; RETURN;
  END IF;
  IF p_ends_at <= p_starts_at THEN
    RETURN QUERY SELECT FALSE, 'End must be after start'::text, NULL::uuid; RETURN;
  END IF;
  INSERT INTO public.tournaments(name, market, kind, entry_fee, prize_pool, starts_at, ends_at, created_by)
    VALUES (p_name, p_market, p_kind, GREATEST(0,p_entry_fee), GREATEST(0,p_prize_pool), p_starts_at, p_ends_at, auth.uid())
    RETURNING id INTO v_id;
  RETURN QUERY SELECT TRUE, 'Tournament created'::text, v_id;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_recurring_tournaments()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_day_start timestamptz := date_trunc('day', now());
  v_day_end   timestamptz := v_day_start + interval '1 day';
  v_week_start timestamptz := date_trunc('week', now());
  v_week_end   timestamptz := v_week_start + interval '7 days';
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.tournaments WHERE kind='daily' AND starts_at=v_day_start) THEN
    INSERT INTO public.tournaments(name, market, kind, entry_fee, prize_pool, starts_at, ends_at)
      VALUES ('Daily Sprint '||to_char(v_day_start,'Mon DD'),'both','daily',100,500,v_day_start,v_day_end);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tournaments WHERE kind='weekly' AND starts_at=v_week_start) THEN
    INSERT INTO public.tournaments(name, market, kind, entry_fee, prize_pool, starts_at, ends_at)
      VALUES ('Weekly Cup '||to_char(v_week_start,'Mon DD'),'both','weekly',250,2500,v_week_start,v_week_end);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_tournaments()
RETURNS TABLE(id uuid, name text, market tournament_market, kind tournament_kind,
              entry_fee numeric, prize_pool numeric, starts_at timestamptz, ends_at timestamptz,
              awarded boolean, entrants bigint, joined boolean, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT t.id, t.name, t.market, t.kind, t.entry_fee, t.prize_pool, t.starts_at, t.ends_at, t.awarded,
    (SELECT COUNT(*) FROM public.tournament_entries e WHERE e.tournament_id=t.id),
    EXISTS(SELECT 1 FROM public.tournament_entries e WHERE e.tournament_id=t.id AND e.user_id=auth.uid()),
    CASE WHEN now() < t.starts_at THEN 'upcoming'
         WHEN now() < t.ends_at THEN 'active'
         ELSE 'ended' END
  FROM public.tournaments t
  WHERE t.ends_at > now() - interval '7 days'
  ORDER BY t.starts_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.join_tournament(p_id uuid)
RETURNS TABLE(success boolean, message text, coins numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid();
  v_t public.tournaments%ROWTYPE;
  v_coins numeric;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE,'Not authenticated'::text,0::numeric; RETURN; END IF;
  SELECT * INTO v_t FROM public.tournaments WHERE id=p_id;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE,'Not found'::text,0::numeric; RETURN; END IF;
  IF now() >= v_t.ends_at THEN RETURN QUERY SELECT FALSE,'Tournament ended'::text,0::numeric; RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.tournament_entries WHERE tournament_id=p_id AND user_id=uid) THEN
    SELECT coins INTO v_coins FROM public.profiles WHERE id=uid;
    RETURN QUERY SELECT TRUE,'Already joined'::text, v_coins; RETURN;
  END IF;
  SELECT coins INTO v_coins FROM public.profiles WHERE id=uid FOR UPDATE;
  IF v_coins < v_t.entry_fee THEN
    RETURN QUERY SELECT FALSE,('Need '||v_t.entry_fee::text||' coins')::text, v_coins; RETURN;
  END IF;
  UPDATE public.profiles SET coins=coins - v_t.entry_fee WHERE id=uid RETURNING coins INTO v_coins;
  -- entry fees grow the prize pool
  UPDATE public.tournaments SET prize_pool = prize_pool + v_t.entry_fee WHERE id=p_id;
  INSERT INTO public.tournament_entries(tournament_id, user_id, fee_paid) VALUES (p_id, uid, v_t.entry_fee);
  RETURN QUERY SELECT TRUE,'Joined!'::text, v_coins;
END $$;

CREATE OR REPLACE FUNCTION public.get_tournament_leaderboard(p_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE(rank bigint, user_id uuid, username text, coins_earned numeric, trades bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH t AS (SELECT * FROM public.tournaments WHERE id=p_id),
  agg AS (
    SELECT tx.user_id, COALESCE(SUM(tx.pnl),0) AS earned, COUNT(*) AS trades
    FROM public.transactions tx, t
    WHERE tx.created_at >= t.starts_at AND tx.created_at < t.ends_at
      AND tx.type='sell'
      AND tx.user_id IN (SELECT user_id FROM public.tournament_entries WHERE tournament_id=p_id)
      AND (
        t.market='both'
        OR (t.market='forex' AND tx.symbol ~ '=X$')
        OR (t.market='stock' AND tx.symbol !~ '=X$')
      )
    GROUP BY tx.user_id
  )
  SELECT ROW_NUMBER() OVER (ORDER BY a.earned DESC), a.user_id,
         COALESCE(p.username, p.display_name,'Trader'), a.earned, a.trades
  FROM agg a JOIN public.profiles p ON p.id=a.user_id
  ORDER BY a.earned DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$$;

CREATE OR REPLACE FUNCTION public.award_tournament(p_id uuid)
RETURNS TABLE(awarded boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_t public.tournaments%ROWTYPE;
  v_split numeric[] := ARRAY[0.5, 0.3, 0.2];
  r RECORD; v_rank int := 0; v_prize numeric;
BEGIN
  SELECT * INTO v_t FROM public.tournaments WHERE id=p_id;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE,'Not found'::text; RETURN; END IF;
  IF v_t.awarded THEN RETURN QUERY SELECT FALSE,'Already awarded'::text; RETURN; END IF;
  IF now() < v_t.ends_at THEN RETURN QUERY SELECT FALSE,'Not ended'::text; RETURN; END IF;
  FOR r IN SELECT * FROM public.get_tournament_leaderboard(p_id, 3) LOOP
    v_rank := v_rank + 1;
    v_prize := ROUND(v_t.prize_pool * v_split[v_rank], 2);
    IF v_prize > 0 AND r.coins_earned > 0 THEN
      INSERT INTO public.tournament_winners(tournament_id, user_id, username, rank, prize)
        VALUES (p_id, r.user_id, r.username, v_rank, v_prize)
        ON CONFLICT DO NOTHING;
      UPDATE public.profiles SET coins = coins + v_prize WHERE id = r.user_id;
    END IF;
  END LOOP;
  UPDATE public.tournaments SET awarded=true WHERE id=p_id;
  RETURN QUERY SELECT TRUE,'Awarded'::text;
END $$;

-- Award any ended-but-not-awarded tournaments (called from client on home load)
CREATE OR REPLACE FUNCTION public.award_pending_tournaments()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD; n int := 0;
BEGIN
  FOR r IN SELECT id FROM public.tournaments WHERE awarded=false AND ends_at < now() LOOP
    PERFORM public.award_tournament(r.id); n := n+1;
  END LOOP;
  RETURN n;
END $$;
