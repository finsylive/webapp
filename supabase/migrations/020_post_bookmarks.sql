-- Post bookmarks table
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own post_bookmarks" ON public.post_bookmarks
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_post_bookmarks_user ON public.post_bookmarks(user_id, created_at DESC);
CREATE INDEX idx_post_bookmarks_post ON public.post_bookmarks(post_id);
