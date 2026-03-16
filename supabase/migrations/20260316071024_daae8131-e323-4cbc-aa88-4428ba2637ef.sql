CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "No public reads" ON public.waitlist
  FOR SELECT TO anon, authenticated
  USING (false);