
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  coins NUMERIC NOT NULL DEFAULT 100,
  last_reward_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Holdings
CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  quantity NUMERIC NOT NULL DEFAULT 0,
  avg_buy_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own holdings sel" ON public.holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own holdings ins" ON public.holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own holdings upd" ON public.holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users manage own holdings del" ON public.holdings FOR DELETE USING (auth.uid() = user_id);

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy','sell')),
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  coins_delta NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tx" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tx" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER holdings_updated BEFORE UPDATE ON public.holdings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, coins)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 100)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Daily reward
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS TABLE(claimed BOOLEAN, coins NUMERIC, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  prof RECORD;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Not authenticated'::TEXT; RETURN;
  END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, coins, last_reward_date) VALUES (uid, 150, CURRENT_DATE);
    RETURN QUERY SELECT TRUE, 150::NUMERIC, 'Welcome! +50 daily reward'::TEXT; RETURN;
  END IF;
  IF prof.last_reward_date IS DISTINCT FROM CURRENT_DATE THEN
    UPDATE public.profiles SET coins = coins + 50, last_reward_date = CURRENT_DATE WHERE id = uid
    RETURNING coins INTO prof.coins;
    RETURN QUERY SELECT TRUE, prof.coins, '+50 coins daily reward!'::TEXT; RETURN;
  END IF;
  RETURN QUERY SELECT FALSE, prof.coins, 'Already claimed today'::TEXT;
END; $$;

-- Execute trade
CREATE OR REPLACE FUNCTION public.execute_trade(
  p_symbol TEXT, p_currency TEXT, p_type TEXT, p_quantity NUMERIC, p_price NUMERIC
) RETURNS TABLE(success BOOLEAN, coins NUMERIC, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  prof RECORD;
  hold RECORD;
  cost NUMERIC;
  proceeds NUMERIC;
  pnl NUMERIC;
  new_qty NUMERIC;
  new_avg NUMERIC;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Not authenticated'::TEXT; RETURN; END IF;
  IF p_quantity <= 0 OR p_price <= 0 THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Invalid trade'::TEXT; RETURN; END IF;
  IF p_type NOT IN ('buy','sell') THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Invalid type'::TEXT; RETURN; END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'No profile'::TEXT; RETURN; END IF;

  SELECT * INTO hold FROM public.holdings WHERE user_id = uid AND symbol = p_symbol FOR UPDATE;

  IF p_type = 'buy' THEN
    cost := p_quantity * p_price;
    IF prof.coins < cost THEN RETURN QUERY SELECT FALSE, prof.coins, 'Not enough coins'::TEXT; RETURN; END IF;
    IF FOUND THEN
      new_qty := hold.quantity + p_quantity;
      new_avg := ((hold.quantity * hold.avg_buy_price) + cost) / new_qty;
      UPDATE public.holdings SET quantity = new_qty, avg_buy_price = new_avg, currency = p_currency
        WHERE id = hold.id;
    ELSE
      INSERT INTO public.holdings (user_id, symbol, currency, quantity, avg_buy_price)
        VALUES (uid, p_symbol, p_currency, p_quantity, p_price);
    END IF;
    UPDATE public.profiles SET coins = coins - cost WHERE id = uid RETURNING coins INTO prof.coins;
    INSERT INTO public.transactions (user_id, symbol, type, quantity, price, coins_delta)
      VALUES (uid, p_symbol, 'buy', p_quantity, p_price, -cost);
    RETURN QUERY SELECT TRUE, prof.coins, 'Bought'::TEXT;
  ELSE
    IF NOT FOUND OR hold.quantity < p_quantity THEN
      RETURN QUERY SELECT FALSE, prof.coins, 'Not enough holdings'::TEXT; RETURN;
    END IF;
    proceeds := p_quantity * p_price;
    pnl := (p_price - hold.avg_buy_price) * p_quantity;
    new_qty := hold.quantity - p_quantity;
    IF new_qty <= 0 THEN
      DELETE FROM public.holdings WHERE id = hold.id;
    ELSE
      UPDATE public.holdings SET quantity = new_qty WHERE id = hold.id;
    END IF;
    UPDATE public.profiles SET coins = coins + proceeds WHERE id = uid RETURNING coins INTO prof.coins;
    INSERT INTO public.transactions (user_id, symbol, type, quantity, price, coins_delta)
      VALUES (uid, p_symbol, 'sell', p_quantity, p_price, proceeds);
    RETURN QUERY SELECT TRUE, prof.coins,
      CASE WHEN pnl >= 0 THEN 'Profit +' || round(pnl, 2)::TEXT ELSE 'Loss ' || round(pnl, 2)::TEXT END;
  END IF;
END; $$;
