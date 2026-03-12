-- Post reports table
CREATE TABLE IF NOT EXISTS public.post_reports (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  reporter_id UUID NOT NULL,
  reported_post_id UUID NOT NULL,
  reason TEXT NOT NULL,
  additional_info TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NULL,
  moderator_id UUID NULL,
  moderator_notes TEXT NULL,
  CONSTRAINT post_reports_pkey PRIMARY KEY (id),
  CONSTRAINT post_reports_moderator_fk FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT post_reports_reported_post_fk FOREIGN KEY (reported_post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT post_reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT post_reports_status_check CHECK (
    status = ANY (ARRAY['pending', 'reviewed', 'closed', 'action_taken'])
  )
);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports and read their own reports
CREATE POLICY "Users can create reports" ON public.post_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can read own reports" ON public.post_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS idx_post_reports_reporter_id ON public.post_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_reported_post ON public.post_reports(reported_post_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_moderator_id ON public.post_reports(moderator_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_status ON public.post_reports(status);
