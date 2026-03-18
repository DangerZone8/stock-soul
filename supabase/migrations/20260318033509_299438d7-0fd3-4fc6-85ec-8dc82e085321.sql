CREATE TABLE public.waitlist_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON public.waitlist_emails
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "No public reads" ON public.waitlist_emails
  FOR SELECT TO anon, authenticated USING (false);