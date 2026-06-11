-- Copy Trading Tables

-- Traders that can be copied
CREATE TABLE public.copy_traders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_accepting_copiers BOOLEAN NOT NULL DEFAULT true,
  performance_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (performance_fee_percent >= 0 AND performance_fee_percent <= 50),
  min_copy_amount DECIMAL(10,2) NOT NULL DEFAULT 100 CHECK (min_copy_amount >= 0),
  max_copy_amount DECIMAL(10,2) DEFAULT 10000,
  description TEXT,
  total_copiers INTEGER NOT NULL DEFAULT 0,
  total_copied_volume DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users copying a trader
CREATE TABLE public.copy_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allocated_coins DECIMAL(10,2) NOT NULL CHECK (allocated_coins > 0),
  copy_proportion DECIMAL(5,4) NOT NULL DEFAULT 1.0 CHECK (copy_proportion > 0 AND copy_proportion <= 10),
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_profit DECIMAL(10,2) NOT NULL DEFAULT 0,
  copied_trades_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(copier_id, trader_id)
);

-- Record of copied trades
CREATE TABLE public.copied_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_relationship_id UUID NOT NULL REFERENCES public.copy_relationships(id) ON DELETE CASCADE,
  original_trade_id UUID,  -- Reference to the original holding/trade
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  quantity DECIMAL(10,4) NOT NULL,
  price DECIMAL(10,4) NOT NULL,
  original_quantity DECIMAL(10,4) NOT NULL,  -- Original trader's quantity
  original_price DECIMAL(10,4) NOT NULL,
  profit DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.copy_traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copied_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for copy_traders
CREATE POLICY "view_all_copy_traders" ON public.copy_traders FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_own_trader_profile" ON public.copy_traders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_trader_profile" ON public.copy_traders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_trader_profile" ON public.copy_traders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for copy_relationships
CREATE POLICY "view_own_copies" ON public.copy_relationships FOR SELECT
  TO authenticated USING (auth.uid() = copier_id OR auth.uid() = trader_id);
CREATE POLICY "insert_as_copier" ON public.copy_relationships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = copier_id);
CREATE POLICY "update_own_copy" ON public.copy_relationships FOR UPDATE
  TO authenticated USING (auth.uid() = copier_id) WITH CHECK (auth.uid() = copier_id);
CREATE POLICY "delete_own_copy" ON public.copy_relationships FOR DELETE
  TO authenticated USING (auth.uid() = copier_id);

-- RLS Policies for copied_trades
CREATE POLICY "view_own_copied_trades" ON public.copied_trades FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.copy_relationships cr
      WHERE cr.id = copied_trades.copy_relationship_id
      AND (cr.copier_id = auth.uid() OR cr.trader_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX idx_copy_traders_user ON public.copy_traders(user_id);
CREATE INDEX idx_copy_relationships_copier ON public.copy_relationships(copier_id);
CREATE INDEX idx_copy_relationships_trader ON public.copy_relationships(trader_id);
CREATE INDEX idx_copied_trades_relation ON public.copied_trades(copy_relationship_id);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.copy_traders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.copy_relationships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.copied_trades;

-- Function to get top traders for copy trading
CREATE OR REPLACE FUNCTION public.get_copy_traders(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  coins DECIMAL,
  net_profit DECIMAL,
  total_copiers BIGINT,
  win_rate DECIMAL,
  is_accepting BOOLEAN,
  description TEXT,
  min_copy DECIMAL,
  max_copy DECIMAL,
  fee_percent DECIMAL
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    p.username::TEXT,
    p.coins,
    p.net_profit,
    COALESCE(ct.total_copiers, 0)::BIGINT,
    COALESCE(
      (SELECT COUNT(*)::DECIMAL / NULLIF((SELECT COUNT(*) FROM public.holdings h WHERE h.user_id = u.id), 0) * 100
       FROM public.holdings h2 
       WHERE h2.user_id = u.id), 0
    ) AS win_rate,
    ct.is_accepting_copiers AS is_accepting,
    ct.description,
    ct.min_copy_amount AS min_copy,
    ct.max_copy_amount AS max_copy,
    ct.performance_fee_percent AS fee_percent
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.copy_traders ct ON ct.user_id = u.id
  WHERE ct.is_accepting_copiers = true OR ct.is_accepting_copiers IS NULL
  ORDER BY p.net_profit DESC NULLS LAST, p.coins DESC
  LIMIT p_limit;
END;
$$;

-- Function to start copying a trader
CREATE OR REPLACE FUNCTION public.start_copy_trading(
  p_trader_id UUID,
  p_allocated_coins DECIMAL(10,2)
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_trader_coins DECIMAL;
  v_min_copy DECIMAL;
  v_max_copy DECIMAL;
  v_is_accepting BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  IF v_user_id = p_trader_id THEN
    RETURN QUERY SELECT false, 'Cannot copy yourself'::TEXT;
    RETURN;
  END IF;

  -- Check if already copying
  IF EXISTS (SELECT 1 FROM public.copy_relationships WHERE copier_id = v_user_id AND trader_id = p_trader_id AND is_active = true) THEN
    RETURN QUERY SELECT false, 'Already copying this trader'::TEXT;
    RETURN;
  END IF;

  -- Check user has enough coins
  SELECT coins INTO v_trader_coins FROM public.profiles WHERE id = v_user_id;
  IF v_trader_coins < p_allocated_coins THEN
    RETURN QUERY SELECT false, 'Insufficient coins to allocate'::TEXT;
    RETURN;
  END IF;

  -- Get trader settings
  SELECT ct.min_copy_amount, ct.max_copy_amount, ct.is_accepting_copiers
  INTO v_min_copy, v_max_copy, v_is_accepting
  FROM public.copy_traders ct
  WHERE ct.user_id = p_trader_id;

  -- If no trader profile, allow with defaults
  IF v_min_copy IS NULL THEN
    v_min_copy := 100;
    v_is_accepting := true;
  END IF;

  IF v_is_accepting = false THEN
    RETURN QUERY SELECT false, 'Trader is not accepting copiers'::TEXT;
    RETURN;
  END IF;

  IF p_allocated_coins < v_min_copy THEN
    RETURN QUERY SELECT false, ('Minimum copy amount is ' || v_min_copy)::TEXT;
    RETURN;
  END IF;

  IF v_max_copy IS NOT NULL AND p_allocated_coins > v_max_copy THEN
    RETURN QUERY SELECT false, ('Maximum copy amount is ' || v_max_copy)::TEXT;
    RETURN;
  END IF;

  -- Create copy relationship
  INSERT INTO public.copy_relationships (copier_id, trader_id, allocated_coins)
  VALUES (v_user_id, p_trader_id, p_allocated_coins);

  -- Update trader's total copiers
  INSERT INTO public.copy_traders (user_id, total_copiers)
  VALUES (p_trader_id, 1)
  ON CONFLICT (user_id) DO UPDATE SET total_copiers = copy_traders.total_copiers + 1;

  RETURN QUERY SELECT true, 'Now copying trader successfully!'::TEXT;
END;
$$;

-- Function to stop copy trading
CREATE OR REPLACE FUNCTION public.stop_copy_trading(p_trader_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  UPDATE public.copy_relationships 
  SET is_active = false 
  WHERE copier_id = v_user_id AND trader_id = p_trader_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No active copy relationship found'::TEXT;
    RETURN;
  END IF;

  UPDATE public.copy_traders 
  SET total_copiers = GREATEST(total_copiers - 1, 0)
  WHERE user_id = p_trader_id;

  RETURN QUERY SELECT true, 'Stopped copying trader'::TEXT;
END;
$$;

-- Function to get user's copy relationships
CREATE OR REPLACE FUNCTION public.get_my_copy_relationships()
RETURNS TABLE (
  trader_id UUID,
  username TEXT,
  allocated_coins DECIMAL,
  proportion DECIMAL,
  is_active BOOLEAN,
  total_profit DECIMAL,
  copied_trades BIGINT,
  trader_coins DECIMAL,
  trader_profit DECIMAL
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.trader_id,
    p.username::TEXT,
    cr.allocated_coins,
    cr.copy_proportion,
    cr.is_active,
    cr.total_profit,
    cr.copied_trades_count::BIGINT,
    p2.coins AS trader_coins,
    p2.net_profit AS trader_profit
  FROM public.copy_relationships cr
  JOIN public.profiles p ON p.id = cr.trader_id
  JOIN public.profiles p2 ON p2.id = cr.trader_id
  WHERE cr.copier_id = auth.uid()
  ORDER BY cr.created_at DESC;
END;
$$;

-- Function to become a copy trader
CREATE OR REPLACE FUNCTION public.become_copy_trader(
  p_description TEXT DEFAULT NULL,
  p_min_copy DECIMAL DEFAULT 100,
  p_max_copy DECIMAL DEFAULT NULL,
  p_fee_percent DECIMAL DEFAULT 0
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.copy_traders (user_id, description, min_copy_amount, max_copy_amount, performance_fee_percent, is_accepting_copiers)
  VALUES (v_user_id, p_description, p_min_copy, p_max_copy, p_fee_percent, true)
  ON CONFLICT (user_id) DO UPDATE SET
    description = COALESCE(p_description, copy_traders.description),
    min_copy_amount = COALESCE(p_min_copy, copy_traders.min_copy_amount),
    max_copy_amount = p_max_copy,
    performance_fee_percent = COALESCE(p_fee_percent, copy_traders.performance_fee_percent),
    is_accepting_copiers = true,
    updated_at = now();

  RETURN QUERY SELECT true, 'You are now accepting copiers!'::TEXT;
END;
$$;