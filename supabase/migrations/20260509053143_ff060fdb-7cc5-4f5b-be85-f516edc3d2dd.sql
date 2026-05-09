
-- 1. Profile column for username changes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changes INTEGER NOT NULL DEFAULT 0;

-- 2. Allow public read of basic profile fields for social features
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
CREATE POLICY "Public can view basic profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 3. One-time coin bonus to existing users
UPDATE public.profiles SET coins = coins + 1000;

-- 4. Update handle_new_user for 1000 starter coins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
  VALUES (NEW.id, NEW.email, v_username, v_username, v_code, 1000)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Daily reward 250
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS TABLE(claimed boolean, coins numeric, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  v_last DATE;
  v_coins NUMERIC;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Not authenticated'::TEXT; RETURN; END IF;
  SELECT p.last_reward_date, p.coins INTO v_last, v_coins
    FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, coins, last_reward_date) VALUES (uid, 1250, CURRENT_DATE)
      RETURNING public.profiles.coins INTO v_coins;
    RETURN QUERY SELECT TRUE, v_coins, 'Welcome! +250 daily reward'::TEXT; RETURN;
  END IF;
  IF v_last IS DISTINCT FROM CURRENT_DATE THEN
    UPDATE public.profiles SET coins = public.profiles.coins + 250, last_reward_date = CURRENT_DATE
      WHERE id = uid RETURNING public.profiles.coins INTO v_coins;
    RETURN QUERY SELECT TRUE, v_coins, '+250 coins daily reward!'::TEXT; RETURN;
  END IF;
  RETURN QUERY SELECT FALSE, v_coins, 'Already claimed today'::TEXT;
END; $$;

-- 6. Referral 150 / 100
CREATE OR REPLACE FUNCTION public.redeem_referral(p_code text)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  v_referrer UUID;
  v_already UUID;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN; END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN RETURN QUERY SELECT FALSE, 'Enter a code'::TEXT; RETURN; END IF;
  SELECT referred_by INTO v_already FROM public.profiles WHERE id = uid;
  IF v_already IS NOT NULL THEN RETURN QUERY SELECT FALSE, 'Already used a referral'::TEXT; RETURN; END IF;
  SELECT id INTO v_referrer FROM public.profiles
    WHERE upper(referral_code) = upper(trim(p_code)) LIMIT 1;
  IF v_referrer IS NULL THEN RETURN QUERY SELECT FALSE, 'Invalid code'::TEXT; RETURN; END IF;
  IF v_referrer = uid THEN RETURN QUERY SELECT FALSE, 'Cannot refer yourself'::TEXT; RETURN; END IF;
  UPDATE public.profiles SET referred_by = v_referrer, coins = coins + 100 WHERE id = uid;
  UPDATE public.profiles SET coins = coins + 150 WHERE id = v_referrer;
  RETURN QUERY SELECT TRUE, 'Referral applied! +100 coins for you, +150 for your friend'::TEXT;
END; $$;

-- 7. Username change RPC
CREATE OR REPLACE FUNCTION public.change_username(p_new text)
RETURNS TABLE(success boolean, message text, username text, remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  SELECT username_changes INTO v_count FROM public.profiles WHERE id = uid FOR UPDATE;
  IF v_count >= 5 THEN
    RETURN QUERY SELECT FALSE, 'Max 5 username changes reached'::TEXT, NULL::TEXT, 0; RETURN;
  END IF;
  SELECT id INTO v_taken FROM public.profiles WHERE lower(username) = lower(v_clean) AND id <> uid LIMIT 1;
  IF v_taken IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Username already taken'::TEXT, NULL::TEXT, (5 - v_count); RETURN;
  END IF;
  UPDATE public.profiles SET username = v_clean, username_changes = username_changes + 1, display_name = v_clean WHERE id = uid;
  RETURN QUERY SELECT TRUE, 'Username updated'::TEXT, v_clean, (5 - v_count - 1);
END; $$;

-- 8. Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  addressee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id),
  CHECK (status IN ('pending','accepted'))
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own friendships" ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "request friendship" ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "update own friendship" ON public.friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "delete own friendship" ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee uuid)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid UUID := auth.uid(); v_existing TEXT;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN; END IF;
  IF p_addressee = uid THEN RETURN QUERY SELECT FALSE, 'Cannot friend yourself'::TEXT; RETURN; END IF;
  SELECT status INTO v_existing FROM public.friendships
    WHERE (requester_id = uid AND addressee_id = p_addressee)
       OR (requester_id = p_addressee AND addressee_id = uid) LIMIT 1;
  IF v_existing = 'accepted' THEN RETURN QUERY SELECT FALSE, 'Already friends'::TEXT; RETURN; END IF;
  IF v_existing = 'pending' THEN RETURN QUERY SELECT FALSE, 'Request already pending'::TEXT; RETURN; END IF;
  INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES (uid, p_addressee, 'pending');
  RETURN QUERY SELECT TRUE, 'Friend request sent'::TEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_requester uuid)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, 'Not authenticated'::TEXT; RETURN; END IF;
  UPDATE public.friendships SET status = 'accepted', updated_at = now()
    WHERE requester_id = p_requester AND addressee_id = uid AND status = 'pending';
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'No pending request'::TEXT; RETURN; END IF;
  RETURN QUERY SELECT TRUE, 'Friend added'::TEXT;
END; $$;

-- 9. Follows
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "create own follow" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "delete own follow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- 10. Direct messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own messages" ON public.direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "send messages" ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_pair ON public.direct_messages(sender_id, recipient_id, created_at DESC);

-- 11. Search & profile RPCs
CREATE OR REPLACE FUNCTION public.search_users(p_q text, p_limit int DEFAULT 10)
RETURNS TABLE(id uuid, username text, coins numeric, net_profit numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, COALESCE(p.username, p.display_name, 'Trader'), p.coins, p.net_profit
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND lower(p.username) LIKE lower(trim(p_q)) || '%'
    AND p.id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY p.coins DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
$$;

CREATE OR REPLACE FUNCTION public.get_user_public(p_user uuid)
RETURNS TABLE(id uuid, username text, coins numeric, net_profit numeric, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, COALESCE(p.username, p.display_name, 'Trader'), p.coins, p.net_profit, p.created_at
  FROM public.profiles p WHERE p.id = p_user;
$$;

CREATE OR REPLACE FUNCTION public.get_user_recent_trades(p_user uuid, p_limit int DEFAULT 10)
RETURNS TABLE(symbol text, type text, quantity numeric, price numeric, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.symbol, t.type, t.quantity, t.price, t.created_at
  FROM public.transactions t WHERE t.user_id = p_user
  ORDER BY t.created_at DESC LIMIT GREATEST(1, LEAST(p_limit, 25));
$$;

CREATE OR REPLACE FUNCTION public.get_friends_leaderboard(p_kind text DEFAULT 'coins')
RETURNS TABLE(rank bigint, user_id uuid, username text, coins numeric, net_profit numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH friends AS (
    SELECT CASE WHEN requester_id = auth.uid() THEN addressee_id ELSE requester_id END AS fid
    FROM public.friendships
    WHERE status = 'accepted' AND (requester_id = auth.uid() OR addressee_id = auth.uid())
    UNION SELECT auth.uid()
  )
  SELECT ROW_NUMBER() OVER (ORDER BY CASE WHEN p_kind='profit' THEN p.net_profit ELSE p.coins END DESC) AS rank,
    p.id, COALESCE(p.username, p.display_name,'Trader'), p.coins, p.net_profit
  FROM public.profiles p JOIN friends f ON f.fid = p.id
  ORDER BY CASE WHEN p_kind='profit' THEN p.net_profit ELSE p.coins END DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_friendships()
RETURNS TABLE(other_id uuid, username text, coins numeric, net_profit numeric, status text, is_incoming boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS other_id,
    COALESCE(p.username, p.display_name, 'Trader') AS username,
    p.coins, p.net_profit, f.status,
    (f.addressee_id = auth.uid() AND f.status = 'pending') AS is_incoming
  FROM public.friendships f
  JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  WHERE f.requester_id = auth.uid() OR f.addressee_id = auth.uid()
  ORDER BY f.status DESC, f.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.toggle_follow(p_target uuid)
RETURNS TABLE(success boolean, following boolean, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid UUID := auth.uid(); v_exists BOOLEAN;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE, FALSE, 'Not authenticated'::TEXT; RETURN; END IF;
  IF p_target = uid THEN RETURN QUERY SELECT FALSE, FALSE, 'Cannot follow yourself'::TEXT; RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.follows WHERE follower_id=uid AND following_id=p_target) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.follows WHERE follower_id=uid AND following_id=p_target;
    RETURN QUERY SELECT TRUE, FALSE, 'Unfollowed'::TEXT;
  ELSE
    INSERT INTO public.follows (follower_id, following_id) VALUES (uid, p_target);
    RETURN QUERY SELECT TRUE, TRUE, 'Following'::TEXT;
  END IF;
END; $$;
