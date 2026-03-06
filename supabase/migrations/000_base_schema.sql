-- ============================================================
-- BASE SCHEMA: All core tables for Ments webapp
-- Run this FIRST in Supabase SQL Editor before any other migration
-- ============================================================

-- 1. users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT DEFAULT '',
  about TEXT,
  current_city TEXT,
  tagline TEXT,
  user_type TEXT DEFAULT 'normal_user' CHECK (user_type IN ('mentor', 'normal_user', 'explorer', 'investor', 'founder')),
  created_at TIMESTAMPTZ DEFAULT now(),
  avatar_url TEXT,
  banner_image TEXT,
  is_verified BOOLEAN DEFAULT false,
  fcm_token TEXT,
  is_onboarding_done BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT now(),
  skills TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all profiles" ON public.users;
CREATE POLICY "Users can read all profiles" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. environments
CREATE TABLE IF NOT EXISTS public.environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  picture TEXT,
  banner TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for environments" ON public.environments;
CREATE POLICY "Public read for environments" ON public.environments FOR SELECT USING (true);

-- 3. posts
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES public.environments(id) ON DELETE SET NULL,
  parent_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  content TEXT,
  post_type TEXT DEFAULT 'text' CHECK (post_type IN ('text', 'media', 'poll')),
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_environment ON public.posts(environment_id);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON public.posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_not_deleted ON public.posts(id) WHERE deleted = false;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for posts" ON public.posts;
CREATE POLICY "Public read for posts" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- 4. post_likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes(user_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for post_likes" ON public.post_likes;
CREATE POLICY "Public read for post_likes" ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
CREATE POLICY "Users can like posts" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;
CREATE POLICY "Users can unlike posts" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- 5. post_media
CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('video', 'photo')),
  media_thumbnail TEXT,
  width INT,
  height INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post ON public.post_media(post_id);

ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for post_media" ON public.post_media;
CREATE POLICY "Public read for post_media" ON public.post_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can add post media" ON public.post_media;
CREATE POLICY "Users can add post media" ON public.post_media FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete post media" ON public.post_media;
CREATE POLICY "Users can delete post media" ON public.post_media FOR DELETE USING (true);

-- 6. post_polls
CREATE TABLE IF NOT EXISTS public.post_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  question TEXT,
  poll_type TEXT DEFAULT 'single_choice' CHECK (poll_type IN ('single_choice', 'multiple_choice')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_polls_post ON public.post_polls(post_id);

ALTER TABLE public.post_polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for post_polls" ON public.post_polls;
CREATE POLICY "Public read for post_polls" ON public.post_polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create polls" ON public.post_polls;
CREATE POLICY "Users can create polls" ON public.post_polls FOR INSERT WITH CHECK (true);

-- 7. post_poll_options
CREATE TABLE IF NOT EXISTS public.post_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  votes INT DEFAULT 0,
  position INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON public.post_poll_options(poll_id);

ALTER TABLE public.post_poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for poll_options" ON public.post_poll_options;
CREATE POLICY "Public read for poll_options" ON public.post_poll_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create poll options" ON public.post_poll_options;
CREATE POLICY "Users can create poll options" ON public.post_poll_options FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update poll options" ON public.post_poll_options;
CREATE POLICY "Users can update poll options" ON public.post_poll_options FOR UPDATE USING (true);

-- 8. post_poll_votes
CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_option_id UUID NOT NULL REFERENCES public.post_poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON public.post_poll_votes(poll_option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON public.post_poll_votes(user_id);

ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for poll_votes" ON public.post_poll_votes;
CREATE POLICY "Public read for poll_votes" ON public.post_poll_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can vote" ON public.post_poll_votes;
CREATE POLICY "Users can vote" ON public.post_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove vote" ON public.post_poll_votes;
CREATE POLICY "Users can remove vote" ON public.post_poll_votes FOR DELETE USING (auth.uid() = user_id);

-- 9. post_reports
CREATE TABLE IF NOT EXISTS public.post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can report posts" ON public.post_reports;
CREATE POLICY "Users can report posts" ON public.post_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own reports" ON public.post_reports;
CREATE POLICY "Users can read own reports" ON public.post_reports FOR SELECT USING (auth.uid() = user_id);

-- 10. post_reposts
CREATE TABLE IF NOT EXISTS public.post_reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for reposts" ON public.post_reposts;
CREATE POLICY "Public read for reposts" ON public.post_reposts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can repost" ON public.post_reposts;
CREATE POLICY "Users can repost" ON public.post_reposts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove repost" ON public.post_reposts;
CREATE POLICY "Users can remove repost" ON public.post_reposts FOR DELETE USING (auth.uid() = user_id);

-- 11. trending_overrides
CREATE TABLE IF NOT EXISTS public.trending_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'removed',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trending_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for trending_overrides" ON public.trending_overrides;
CREATE POLICY "Public read for trending_overrides" ON public.trending_overrides FOR SELECT USING (true);

-- 12. user_follows
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_followee ON public.user_follows(followee_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for follows" ON public.user_follows;
CREATE POLICY "Public read for follows" ON public.user_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow" ON public.user_follows;
CREATE POLICY "Users can follow" ON public.user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON public.user_follows;
CREATE POLICY "Users can unfollow" ON public.user_follows FOR DELETE USING (auth.uid() = follower_id);

-- 13. conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON public.conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON public.conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations(updated_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own conversations" ON public.conversations;
CREATE POLICY "Users can read own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 14. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  media_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
  )
);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
CREATE POLICY "Users can update messages" ON public.messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
  )
);

-- 15. message_reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, message_id)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read message reactions" ON public.message_reactions;
CREATE POLICY "Users can read message reactions" ON public.message_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
CREATE POLICY "Users can add reactions" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove reactions" ON public.message_reactions;
CREATE POLICY "Users can remove reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- 16. chat_categories
CREATE TABLE IF NOT EXISTS public.chat_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own chat categories" ON public.chat_categories;
CREATE POLICY "Users can manage own chat categories" ON public.chat_categories FOR ALL USING (auth.uid() = user_id);

-- 17. conversation_categories
CREATE TABLE IF NOT EXISTS public.conversation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.chat_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversation_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own conversation categories" ON public.conversation_categories;
CREATE POLICY "Users can manage own conversation categories" ON public.conversation_categories FOR ALL USING (true);

-- 18. work_experiences
CREATE TABLE IF NOT EXISTS public.work_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  domain TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.work_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for work_experiences" ON public.work_experiences;
CREATE POLICY "Public read for work_experiences" ON public.work_experiences FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own work_experiences" ON public.work_experiences;
CREATE POLICY "Users can manage own work_experiences" ON public.work_experiences FOR ALL USING (auth.uid() = user_id);

-- 19. positions
CREATE TABLE IF NOT EXISTS public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES public.work_experiences(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for positions" ON public.positions;
CREATE POLICY "Public read for positions" ON public.positions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage positions" ON public.positions;
CREATE POLICY "Users can manage positions" ON public.positions FOR ALL USING (true);

-- 20. education
CREATE TABLE IF NOT EXISTS public.education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL,
  institution_domain TEXT,
  degree TEXT,
  field_of_study TEXT,
  start_date DATE,
  end_date DATE,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for education" ON public.education;
CREATE POLICY "Public read for education" ON public.education FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own education" ON public.education;
CREATE POLICY "Users can manage own education" ON public.education FOR ALL USING (auth.uid() = user_id);

-- 21. projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  tagline TEXT,
  cover_url TEXT,
  logo_url TEXT,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for projects" ON public.projects;
CREATE POLICY "Public read for projects" ON public.projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
CREATE POLICY "Users can manage own projects" ON public.projects FOR ALL USING (auth.uid() = owner_id);

-- 22. project_links
CREATE TABLE IF NOT EXISTS public.project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT NOT NULL,
  icon_name TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for project_links" ON public.project_links;
CREATE POLICY "Public read for project_links" ON public.project_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage project_links" ON public.project_links;
CREATE POLICY "Users can manage project_links" ON public.project_links FOR ALL USING (true);

-- 23. project_slides
CREATE TABLE IF NOT EXISTS public.project_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slide_url TEXT NOT NULL,
  caption TEXT,
  slide_number INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for project_slides" ON public.project_slides;
CREATE POLICY "Public read for project_slides" ON public.project_slides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage project_slides" ON public.project_slides;
CREATE POLICY "Users can manage project_slides" ON public.project_slides FOR ALL USING (true);

-- 24. project_text_sections
CREATE TABLE IF NOT EXISTS public.project_text_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  heading TEXT,
  content TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_text_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for project_text_sections" ON public.project_text_sections;
CREATE POLICY "Public read for project_text_sections" ON public.project_text_sections FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage project_text_sections" ON public.project_text_sections;
CREATE POLICY "Users can manage project_text_sections" ON public.project_text_sections FOR ALL USING (true);

-- 25. portfolios
CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for portfolios" ON public.portfolios;
CREATE POLICY "Public read for portfolios" ON public.portfolios FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own portfolios" ON public.portfolios;
CREATE POLICY "Users can manage own portfolios" ON public.portfolios FOR ALL USING (auth.uid() = user_id);

-- 26. portfolio_platforms
CREATE TABLE IF NOT EXISTS public.portfolio_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  platform TEXT CHECK (platform IN ('github', 'figma', 'dribbble', 'behance', 'linkedin', 'youtube', 'notion', 'substack', 'custom')),
  link TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.portfolio_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for portfolio_platforms" ON public.portfolio_platforms;
CREATE POLICY "Public read for portfolio_platforms" ON public.portfolio_platforms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage portfolio_platforms" ON public.portfolio_platforms;
CREATE POLICY "Users can manage portfolio_platforms" ON public.portfolio_platforms FOR ALL USING (true);

-- 27. startup_profiles
CREATE TABLE IF NOT EXISTS public.startup_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  registered_name TEXT,
  legal_status TEXT DEFAULT 'not_registered' CHECK (legal_status IN ('llp', 'pvt_ltd', 'sole_proprietorship', 'not_registered')),
  cin TEXT,
  stage TEXT DEFAULT 'ideation' CHECK (stage IN ('ideation', 'mvp', 'scaling', 'expansion', 'maturity')),
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  website TEXT,
  founded_date DATE,
  address_line1 TEXT,
  address_line2 TEXT,
  state TEXT,
  startup_email TEXT,
  startup_phone TEXT,
  pitch_deck_url TEXT,
  is_actively_raising BOOLEAN DEFAULT false,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'investors_only', 'private')),
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_startup_profiles_owner ON public.startup_profiles(owner_id);

ALTER TABLE public.startup_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for startup_profiles" ON public.startup_profiles;
CREATE POLICY "Public read for startup_profiles" ON public.startup_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own startup_profiles" ON public.startup_profiles;
CREATE POLICY "Users can manage own startup_profiles" ON public.startup_profiles FOR ALL USING (auth.uid() = owner_id);

-- 28. startup_founders
CREATE TABLE IF NOT EXISTS public.startup_founders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startup_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  linkedin_url TEXT,
  email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ments_username TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined')),
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_startup_founders_startup ON public.startup_founders(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_founders_user_id ON public.startup_founders(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_startup_founders_pending ON public.startup_founders(user_id, status) WHERE status = 'pending';

ALTER TABLE public.startup_founders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for startup_founders" ON public.startup_founders;
CREATE POLICY "Public read for startup_founders" ON public.startup_founders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage startup_founders" ON public.startup_founders;
CREATE POLICY "Users can manage startup_founders" ON public.startup_founders FOR ALL USING (true);

-- 29. startup_funding_rounds
CREATE TABLE IF NOT EXISTS public.startup_funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startup_profiles(id) ON DELETE CASCADE,
  investor TEXT,
  amount TEXT,
  round_type TEXT CHECK (round_type IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'other')),
  round_date DATE,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.startup_funding_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for startup_funding_rounds" ON public.startup_funding_rounds;
CREATE POLICY "Public read for startup_funding_rounds" ON public.startup_funding_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage funding rounds" ON public.startup_funding_rounds;
CREATE POLICY "Users can manage funding rounds" ON public.startup_funding_rounds FOR ALL USING (true);

-- 30. startup_incubators
CREATE TABLE IF NOT EXISTS public.startup_incubators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startup_profiles(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  year INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.startup_incubators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for startup_incubators" ON public.startup_incubators;
CREATE POLICY "Public read for startup_incubators" ON public.startup_incubators FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage startup_incubators" ON public.startup_incubators;
CREATE POLICY "Users can manage startup_incubators" ON public.startup_incubators FOR ALL USING (true);

-- 31. startup_awards
CREATE TABLE IF NOT EXISTS public.startup_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startup_profiles(id) ON DELETE CASCADE,
  award_name TEXT NOT NULL,
  year INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.startup_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for startup_awards" ON public.startup_awards;
CREATE POLICY "Public read for startup_awards" ON public.startup_awards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage startup_awards" ON public.startup_awards;
CREATE POLICY "Users can manage startup_awards" ON public.startup_awards FOR ALL USING (true);

-- 32. startup_bookmarks
CREATE TABLE IF NOT EXISTS public.startup_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startup_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, startup_id)
);

ALTER TABLE public.startup_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own startup_bookmarks" ON public.startup_bookmarks;
CREATE POLICY "Users can manage own startup_bookmarks" ON public.startup_bookmarks FOR ALL USING (auth.uid() = user_id);

-- 33. startup_profile_views
CREATE TABLE IF NOT EXISTS public.startup_profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startup_profiles(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.startup_profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert for startup_profile_views" ON public.startup_profile_views;
CREATE POLICY "Public insert for startup_profile_views" ON public.startup_profile_views FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public read for startup_profile_views" ON public.startup_profile_views;
CREATE POLICY "Public read for startup_profile_views" ON public.startup_profile_views FOR SELECT USING (true);

-- 34. competitions
CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  banner_url TEXT,
  prize TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for competitions" ON public.competitions;
CREATE POLICY "Public read for competitions" ON public.competitions FOR SELECT USING (true);

-- 35. competition_entries
CREATE TABLE IF NOT EXISTS public.competition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (competition_id, submitted_by)
);

CREATE INDEX IF NOT EXISTS idx_competition_entries_competition ON public.competition_entries(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_entries_user ON public.competition_entries(submitted_by);

ALTER TABLE public.competition_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for competition_entries" ON public.competition_entries;
CREATE POLICY "Public read for competition_entries" ON public.competition_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join competitions" ON public.competition_entries;
CREATE POLICY "Users can join competitions" ON public.competition_entries FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- 36. events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  location TEXT,
  event_url TEXT,
  banner_image_url TEXT,
  event_type TEXT DEFAULT 'online' CHECK (event_type IN ('online', 'in-person', 'hybrid')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  category TEXT DEFAULT 'event'
);

CREATE INDEX IF NOT EXISTS idx_events_active ON public.events(is_active);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for events" ON public.events;
CREATE POLICY "Public read for events" ON public.events FOR SELECT USING (true);

-- 37. event_participants
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON public.event_participants(user_id);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for event_participants" ON public.event_participants;
CREATE POLICY "Public read for event_participants" ON public.event_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join events" ON public.event_participants;
CREATE POLICY "Users can join events" ON public.event_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave events" ON public.event_participants;
CREATE POLICY "Users can leave events" ON public.event_participants FOR DELETE USING (auth.uid() = user_id);

-- 38. notifications (legacy)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- 39. inapp_notification
CREATE TABLE IF NOT EXISTS public.inapp_notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_avatar_url TEXT,
  actor_username TEXT,
  type TEXT NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  extra JSONB DEFAULT '{}',
  post_id UUID,
  reply_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inapp_notification_recipient ON public.inapp_notification(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inapp_notification_unread ON public.inapp_notification(recipient_id) WHERE is_read = false;

ALTER TABLE public.inapp_notification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own inapp_notifications" ON public.inapp_notification;
CREATE POLICY "Users can read own inapp_notifications" ON public.inapp_notification FOR SELECT USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can update own inapp_notifications" ON public.inapp_notification;
CREATE POLICY "Users can update own inapp_notifications" ON public.inapp_notification FOR UPDATE USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "System can insert inapp_notifications" ON public.inapp_notification;
CREATE POLICY "System can insert inapp_notifications" ON public.inapp_notification FOR INSERT WITH CHECK (true);

-- 40. verification_codes
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own verification_codes" ON public.verification_codes;
CREATE POLICY "Users can manage own verification_codes" ON public.verification_codes FOR ALL USING (auth.uid() = user_id);

-- 41. resources
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  provider TEXT,
  tags TEXT[] DEFAULT '{}',
  eligibility TEXT,
  url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for resources" ON public.resources;
CREATE POLICY "Public read for resources" ON public.resources FOR SELECT USING (true);

-- 42. jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT,
  description TEXT,
  location TEXT,
  job_type TEXT,
  salary_range TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for jobs" ON public.jobs;
CREATE POLICY "Public read for jobs" ON public.jobs FOR SELECT USING (true);

-- 43. gigs
CREATE TABLE IF NOT EXISTS public.gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  budget TEXT,
  deadline TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for gigs" ON public.gigs;
CREATE POLICY "Public read for gigs" ON public.gigs FOR SELECT USING (true);

-- 44. saved_events
CREATE TABLE IF NOT EXISTS public.saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, event_id)
);

ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage saved_events" ON public.saved_events;
CREATE POLICY "Users can manage saved_events" ON public.saved_events FOR ALL USING (auth.uid() = user_id);

-- 45. saved_competitions
CREATE TABLE IF NOT EXISTS public.saved_competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, competition_id)
);

ALTER TABLE public.saved_competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage saved_competitions" ON public.saved_competitions;
CREATE POLICY "Users can manage saved_competitions" ON public.saved_competitions FOR ALL USING (auth.uid() = user_id);


-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- get_posts_with_counts
CREATE OR REPLACE FUNCTION get_posts_with_counts(
  env_id UUID DEFAULT NULL,
  limit_count INT DEFAULT 20,
  offset_count INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  environment_id UUID,
  parent_post_id UUID,
  content TEXT,
  post_type TEXT,
  created_at TIMESTAMPTZ,
  deleted BOOLEAN,
  tags TEXT[],
  likes_count BIGINT,
  replies_count BIGINT,
  author JSONB,
  media JSONB,
  poll JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    p.environment_id,
    p.parent_post_id,
    p.content,
    p.post_type,
    p.created_at,
    p.deleted,
    p.tags,
    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
    (SELECT COUNT(*) FROM posts r WHERE r.parent_post_id = p.id AND r.deleted = false) AS replies_count,
    jsonb_build_object(
      'id', u.id,
      'username', u.username,
      'full_name', u.full_name,
      'avatar_url', u.avatar_url,
      'is_verified', u.is_verified
    ) AS author,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id,
        'media_url', pm.media_url,
        'media_type', pm.media_type,
        'media_thumbnail', pm.media_thumbnail,
        'width', pm.width,
        'height', pm.height
      )) FROM post_media pm WHERE pm.post_id = p.id),
      '[]'::JSONB
    ) AS media,
    CASE WHEN p.post_type = 'poll' THEN (
      SELECT jsonb_build_object(
        'id', pp.id,
        'question', pp.question,
        'poll_type', pp.poll_type,
        'options', COALESCE(
          (SELECT jsonb_agg(jsonb_build_object(
            'id', po.id,
            'option_text', po.option_text,
            'votes', po.votes,
            'position', po.position
          ) ORDER BY po.position) FROM post_poll_options po WHERE po.poll_id = pp.id),
          '[]'::JSONB
        )
      ) FROM post_polls pp WHERE pp.post_id = p.id LIMIT 1
    ) ELSE NULL END AS poll
  FROM posts p
  JOIN users u ON u.id = p.author_id
  WHERE p.deleted = false
    AND p.parent_post_id IS NULL
    AND (env_id IS NULL OR p.environment_id = env_id)
  ORDER BY p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_post_with_counts
CREATE OR REPLACE FUNCTION get_post_with_counts(post_id_param UUID)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  environment_id UUID,
  parent_post_id UUID,
  content TEXT,
  post_type TEXT,
  created_at TIMESTAMPTZ,
  deleted BOOLEAN,
  tags TEXT[],
  likes_count BIGINT,
  replies_count BIGINT,
  author JSONB,
  media JSONB,
  poll JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    p.environment_id,
    p.parent_post_id,
    p.content,
    p.post_type,
    p.created_at,
    p.deleted,
    p.tags,
    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
    (SELECT COUNT(*) FROM posts r WHERE r.parent_post_id = p.id AND r.deleted = false) AS replies_count,
    jsonb_build_object(
      'id', u.id,
      'username', u.username,
      'full_name', u.full_name,
      'avatar_url', u.avatar_url,
      'is_verified', u.is_verified
    ) AS author,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id,
        'media_url', pm.media_url,
        'media_type', pm.media_type,
        'media_thumbnail', pm.media_thumbnail,
        'width', pm.width,
        'height', pm.height
      )) FROM post_media pm WHERE pm.post_id = p.id),
      '[]'::JSONB
    ) AS media,
    CASE WHEN p.post_type = 'poll' THEN (
      SELECT jsonb_build_object(
        'id', pp.id,
        'question', pp.question,
        'poll_type', pp.poll_type,
        'options', COALESCE(
          (SELECT jsonb_agg(jsonb_build_object(
            'id', po.id,
            'option_text', po.option_text,
            'votes', po.votes,
            'position', po.position
          ) ORDER BY po.position) FROM post_poll_options po WHERE po.poll_id = pp.id),
          '[]'::JSONB
        )
      ) FROM post_polls pp WHERE pp.post_id = p.id LIMIT 1
    ) ELSE NULL END AS poll
  FROM posts p
  JOIN users u ON u.id = p.author_id
  WHERE p.id = post_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- like_post
CREATE OR REPLACE FUNCTION like_post(post_id_param UUID, user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO post_likes (post_id, user_id)
  VALUES (post_id_param, user_id_param)
  ON CONFLICT (post_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- unlike_post
CREATE OR REPLACE FUNCTION unlike_post(post_id_param UUID, user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM post_likes
  WHERE post_id = post_id_param AND user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_unread_message_count
CREATE OR REPLACE FUNCTION get_unread_message_count(user_id UUID)
RETURNS INT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INT
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.is_read = false
      AND m.sender_id != user_id
      AND (c.user1_id = user_id OR c.user2_id = user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read access for media" ON storage.objects;
CREATE POLICY "Public read access for media" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;
CREATE POLICY "Users can update own uploads" ON storage.objects
  FOR UPDATE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;
CREATE POLICY "Users can delete own uploads" ON storage.objects
  FOR DELETE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================
-- REALTIME
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inapp_notification;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
