
-- price_alerts
CREATE TABLE public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  market text NOT NULL DEFAULT 'stock', -- 'stock' | 'forex' | 'crypto'
  direction text NOT NULL CHECK (direction IN ('above','below')),
  target_price numeric NOT NULL CHECK (target_price > 0),
  reference_price numeric,
  notify_email boolean NOT NULL DEFAULT false,
  triggered boolean NOT NULL DEFAULT false,
  triggered_at timestamptz,
  triggered_price numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_alerts TO authenticated;
GRANT ALL ON public.price_alerts TO service_role;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts read" ON public.price_alerts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own alerts insert" ON public.price_alerts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own alerts update" ON public.price_alerts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own alerts delete" ON public.price_alerts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX price_alerts_active_idx ON public.price_alerts(symbol) WHERE triggered = false;
CREATE INDEX price_alerts_user_idx ON public.price_alerts(user_id, created_at DESC);

-- notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'info', -- 'price_alert' | 'info' | 'tournament' | ...
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notif read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notif update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notif delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- RPCs
CREATE OR REPLACE FUNCTION public.create_price_alert(
  p_symbol text, p_market text, p_direction text, p_target numeric, p_reference numeric, p_notify_email boolean
) RETURNS TABLE(success boolean, message text, id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF uid IS NULL THEN RETURN QUERY SELECT FALSE,'Not authenticated'::text,NULL::uuid; RETURN; END IF;
  IF p_target IS NULL OR p_target <= 0 THEN RETURN QUERY SELECT FALSE,'Bad target'::text,NULL::uuid; RETURN; END IF;
  IF p_direction NOT IN ('above','below') THEN RETURN QUERY SELECT FALSE,'Bad direction'::text,NULL::uuid; RETURN; END IF;
  IF (SELECT COUNT(*) FROM public.price_alerts WHERE user_id=uid AND triggered=false) >= 50 THEN
    RETURN QUERY SELECT FALSE,'Max 50 active alerts'::text,NULL::uuid; RETURN;
  END IF;
  INSERT INTO public.price_alerts(user_id, symbol, market, direction, target_price, reference_price, notify_email)
    VALUES (uid, upper(trim(p_symbol)), COALESCE(p_market,'stock'), p_direction, p_target, p_reference, COALESCE(p_notify_email,false))
    RETURNING id INTO v_id;
  RETURN QUERY SELECT TRUE, 'Alert set'::text, v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_price_alert(p_id uuid)
RETURNS TABLE(success boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.price_alerts WHERE id = p_id AND user_id = auth.uid();
  RETURN QUERY SELECT FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[] DEFAULT NULL)
RETURNS TABLE(updated int) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF p_ids IS NULL THEN
    UPDATE public.notifications SET read=true WHERE user_id=auth.uid() AND read=false;
  ELSE
    UPDATE public.notifications SET read=true WHERE user_id=auth.uid() AND id = ANY(p_ids);
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN QUERY SELECT n;
END $$;
