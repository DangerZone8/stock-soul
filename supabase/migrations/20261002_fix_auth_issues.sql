-- Fix 1: Add missing columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS net_profit NUMERIC NOT NULL DEFAULT 0;

-- Fix 2: Ensure handle_new_user function properly handles username from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_code TEXT;
  v_display_name TEXT;
BEGIN
  -- Extract username from signup metadata, fallback to email local part
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Sanitize username: only alphanumeric and underscore
  v_username := LOWER(regexp_replace(v_username, '[^a-z0-9_]', '_', 'g'));
  
  -- If username is empty or invalid, use first 8 chars of UUID
  IF v_username IS NULL OR v_username = '' THEN
    v_username := substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;
  
  -- Ensure username is unique by appending suffix if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(v_username)) LOOP
    v_username := v_username || '_' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;
  
  -- Generate referral code
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  
  -- Set display name
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    v_username
  );
  
  -- Insert profile with all required fields
  INSERT INTO public.profiles (id, email, display_name, username, referral_code, coins, net_profit)
  VALUES (NEW.id, NEW.email, v_display_name, v_username, v_code, 1000, 0)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END; $$;

-- Fix 3: Ensure trigger is properly set
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix 4: Add index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Fix 5: Ensure claim_daily_reward handles profile creation gracefully
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS TABLE(claimed BOOLEAN, coins NUMERIC, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_last DATE;
  v_coins NUMERIC;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 'Not authenticated'::TEXT;
    RETURN;
  END IF;
  
  -- Try to get existing profile
  SELECT p.last_reward_date, p.coins INTO v_last, v_coins
    FROM public.profiles p WHERE p.id = uid FOR UPDATE;
  
  -- If profile doesn't exist, create it (shouldn't happen but defensive)
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, coins, last_reward_date, net_profit)
      VALUES (uid, 1250, CURRENT_DATE, 0)
      ON CONFLICT (id) DO UPDATE SET
        coins = EXCLUDED.coins,
        last_reward_date = EXCLUDED.last_reward_date
      RETURNING public.profiles.coins INTO v_coins;
    RETURN QUERY SELECT TRUE, v_coins, 'Welcome! +250 daily reward'::TEXT;
    RETURN;
  END IF;
  
  -- Check if already claimed today
  IF v_last IS DISTINCT FROM CURRENT_DATE THEN
    UPDATE public.profiles 
      SET coins = coins + 250, last_reward_date = CURRENT_DATE
      WHERE id = uid 
      RETURNING coins INTO v_coins;
    RETURN QUERY SELECT TRUE, v_coins, '+250 coins daily reward!'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT FALSE, v_coins, 'Already claimed today'::TEXT;
END; $$;
