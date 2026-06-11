-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_own_notifications" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "insert_own_notifications" ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_notifications" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "delete_own_notifications" ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;