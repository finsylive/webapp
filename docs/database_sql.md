
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id)
);
CREATE TABLE public.admin_profiles (
  id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['superadmin'::text, 'facilitator'::text, 'startup'::text])),
  verification_status text NOT NULL DEFAULT 'pending'::text CHECK (verification_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text])),
  display_name text,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT admin_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid,
  gig_id uuid,
  user_id uuid NOT NULL,
  user_name text,
  user_email text,
  user_avatar_url text,
  user_tagline text,
  user_city text,
  profile_snapshot jsonb DEFAULT '{}'::jsonb,
  match_score integer DEFAULT 0,
  match_breakdown jsonb DEFAULT '{}'::jsonb,
  profile_summary text,
  strengths ARRAY DEFAULT '{}'::text[],
  weaknesses ARRAY DEFAULT '{}'::text[],
  ai_questions jsonb DEFAULT '[]'::jsonb,
  interview_score integer DEFAULT 0,
  overall_score integer DEFAULT 0,
  ai_recommendation text DEFAULT 'pending'::text,
  ai_summary text,
  hire_suggestion text,
  tab_switch_count integer DEFAULT 0,
  time_spent_seconds integer DEFAULT 0,
  status text DEFAULT 'in_progress'::text,
  admin_notes text,
  started_at timestamp with time zone DEFAULT now(),
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  facilitator_id uuid,
  startup_id uuid,
  CONSTRAINT applications_pkey PRIMARY KEY (id),
  CONSTRAINT applications_gig_id_fkey FOREIGN KEY (gig_id) REFERENCES public.gigs(id),
  CONSTRAINT applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT applications_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.admin_profiles(id),
  CONSTRAINT applications_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  actor_id uuid NOT NULL,
  actor_role text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.buckets (
  id text NOT NULL,
  name text NOT NULL,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types ARRAY,
  CONSTRAINT buckets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.chat_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.company_domains (
  id bigint NOT NULL,
  name text,
  domain text,
  CONSTRAINT company_domains_pkey PRIMARY KEY (id)
);
CREATE TABLE public.competition_entries (
  competition_id uuid NOT NULL,
  project_id uuid,
  submitted_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  external_entry_url text,
  status text NOT NULL DEFAULT 'registered'::text CHECK (status = ANY (ARRAY['registered'::text, 'shortlisted'::text, 'winner'::text, 'rejected'::text])),
  admin_notes text,
  CONSTRAINT competition_entries_pkey PRIMARY KEY (competition_id, submitted_by),
  CONSTRAINT competition_entries_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id),
  CONSTRAINT competition_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT competition_entries_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id)
);
CREATE TABLE public.competition_faqs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT competition_faqs_pkey PRIMARY KEY (id),
  CONSTRAINT competition_faqs_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id)
);
CREATE TABLE public.competition_rounds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL,
  round_number integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT competition_rounds_pkey PRIMARY KEY (id),
  CONSTRAINT competition_rounds_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id)
);
CREATE TABLE public.competitions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  deadline timestamp with time zone,
  created_by uuid NOT NULL,
  is_external boolean NOT NULL DEFAULT false,
  external_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  has_leaderboard boolean NOT NULL DEFAULT false,
  prize_pool text,
  banner_image_url text,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  domain text,
  organizer_name text,
  participation_type text NOT NULL DEFAULT 'individual'::text CHECK (participation_type = ANY (ARRAY['individual'::text, 'team'::text])),
  team_size_min integer NOT NULL DEFAULT 1,
  team_size_max integer NOT NULL DEFAULT 1,
  eligibility_criteria text,
  facilitator_id uuid,
  startup_id uuid,
  visibility text NOT NULL DEFAULT 'public'::text,
  target_facilitator_ids ARRAY,
  CONSTRAINT competitions_pkey PRIMARY KEY (id),
  CONSTRAINT competitions_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.admin_profiles(id),
  CONSTRAINT competitions_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.content_embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE,
  topics ARRAY NOT NULL DEFAULT '{}'::text[],
  keywords ARRAY NOT NULL DEFAULT '{}'::text[],
  sentiment double precision,
  language text DEFAULT 'en'::text,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT content_embeddings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.conversation_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversation_categories_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.chat_categories(id),
  CONSTRAINT conversation_categories_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL,
  user2_id uuid NOT NULL,
  last_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'approved'::text,
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.education (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  institution_name text NOT NULL,
  institution_domain text,
  degree text,
  field_of_study text,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT education_pkey PRIMARY KEY (id),
  CONSTRAINT education_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.environments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  picture text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  banner text,
  description text,
  CONSTRAINT environments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.event_audience (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  virtual_balance bigint NOT NULL DEFAULT 1000000,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_audience_pkey PRIMARY KEY (id),
  CONSTRAINT event_audience_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.event_investments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  stall_id uuid NOT NULL,
  investor_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  invested_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_investments_pkey PRIMARY KEY (id),
  CONSTRAINT event_investments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_investments_stall_id_fkey FOREIGN KEY (stall_id) REFERENCES public.event_stalls(id)
);
CREATE TABLE public.event_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_participants_pkey PRIMARY KEY (id),
  CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.event_stalls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  stall_name text NOT NULL,
  tagline text,
  description text,
  demo_url text,
  pitch_deck_url text,
  logo_url text,
  category text,
  startup_id uuid,
  project_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_stalls_pkey PRIMARY KEY (id),
  CONSTRAINT event_stalls_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date timestamp with time zone,
  location text,
  event_url text,
  banner_image_url text,
  event_type text NOT NULL DEFAULT 'online'::text CHECK (event_type = ANY (ARRAY['online'::text, 'in-person'::text, 'hybrid'::text])),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  category text DEFAULT 'event'::text CHECK (category = ANY (ARRAY['event'::text, 'meetup'::text, 'workshop'::text, 'conference'::text, 'seminar'::text])),
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  is_featured boolean NOT NULL DEFAULT false,
  organizer_name text,
  facilitator_id uuid,
  startup_id uuid,
  visibility text NOT NULL DEFAULT 'public'::text,
  target_facilitator_ids ARRAY,
  entry_type text CHECK (entry_type = ANY (ARRAY['startup'::text, 'project'::text])),
  arena_enabled boolean DEFAULT false,
  virtual_fund_amount bigint DEFAULT 1000000,
  arena_round text CHECK (arena_round = ANY (ARRAY['registration'::text, 'investment'::text, 'completed'::text])),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT events_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.admin_profiles(id),
  CONSTRAINT events_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.experiences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT experiences_pkey PRIMARY KEY (id)
);
CREATE TABLE public.facilitator_profiles (
  id uuid NOT NULL,
  organisation_name text NOT NULL,
  organisation_address text NOT NULL,
  organisation_type text NOT NULL CHECK (organisation_type = ANY (ARRAY['ecell'::text, 'incubator'::text, 'accelerator'::text, 'college_cell'::text, 'other'::text])),
  official_email text NOT NULL,
  poc_name text NOT NULL,
  contact_number text NOT NULL,
  website text,
  document_url text,
  verification_notes text,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT facilitator_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT facilitator_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.admin_profiles(id),
  CONSTRAINT facilitator_profiles_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.admin_profiles(id)
);
CREATE TABLE public.facilitator_student_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL,
  email text NOT NULL,
  added_at timestamp with time zone DEFAULT now(),
  CONSTRAINT facilitator_student_emails_pkey PRIMARY KEY (id),
  CONSTRAINT facilitator_student_emails_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES auth.users(id)
);
CREATE TABLE public.feed_analytics_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date date NOT NULL,
  total_impressions bigint NOT NULL DEFAULT 0,
  total_engagements bigint NOT NULL DEFAULT 0,
  engagement_rate double precision NOT NULL DEFAULT 0,
  avg_dwell_ms double precision NOT NULL DEFAULT 0,
  unique_users integer NOT NULL DEFAULT 0,
  avg_feed_depth double precision NOT NULL DEFAULT 0,
  content_type_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_posts ARRAY NOT NULL DEFAULT '{}'::uuid[],
  experiment_id uuid,
  variant text,
  CONSTRAINT feed_analytics_daily_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feed_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_ids ARRAY NOT NULL DEFAULT '{}'::uuid[],
  scores ARRAY NOT NULL DEFAULT '{}'::double precision[],
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  version integer NOT NULL DEFAULT 1,
  experiment_id uuid,
  variant text,
  CONSTRAINT feed_cache_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feed_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['impression'::text, 'dwell'::text, 'scroll_past'::text, 'click'::text, 'like'::text, 'unlike'::text, 'reply'::text, 'share'::text, 'bookmark'::text, 'poll_vote'::text, 'profile_click'::text, 'expand_content'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  position_in_feed integer,
  experiment_id uuid,
  variant text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feed_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feed_experiment_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  variant_id text NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feed_experiment_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT feed_experiment_assignments_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES public.feed_experiments(id),
  CONSTRAINT feed_experiment_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.feed_experiments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'ended'::text])),
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  targeting_rules jsonb DEFAULT '{}'::jsonb,
  metrics ARRAY NOT NULL DEFAULT ARRAY['engagement_rate'::text, 'ctr'::text, 'avg_dwell_ms'::text],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  CONSTRAINT feed_experiments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feed_seen_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  seen_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feed_seen_posts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.founder_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_name text,
  industry text,
  stage text CHECK (stage = ANY (ARRAY['idea'::text, 'pre_seed'::text, 'seed'::text, 'series_a'::text, 'series_b_plus'::text, 'profitable'::text])),
  team_size text CHECK (team_size = ANY (ARRAY['solo'::text, '2_5'::text, '6_20'::text, '21_50'::text, '50_plus'::text])),
  pitch text,
  looking_for ARRAY DEFAULT '{}'::text[],
  website text,
  linkedin text,
  location text,
  is_actively_raising boolean DEFAULT false,
  raise_amount text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT founder_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT founder_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.gigs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  company text NOT NULL,
  description text,
  is_external boolean NOT NULL DEFAULT false,
  external_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  company_logo_url text,
  company_website text,
  category text DEFAULT 'other'::text CHECK (category = ANY (ARRAY['development'::text, 'design'::text, 'writing'::text, 'marketing'::text, 'video'::text, 'audio'::text, 'data'::text, 'consulting'::text, 'other'::text])),
  experience_level text DEFAULT 'any'::text CHECK (experience_level = ANY (ARRAY['any'::text, 'beginner'::text, 'intermediate'::text, 'expert'::text])),
  payment_type text DEFAULT 'fixed'::text CHECK (payment_type = ANY (ARRAY['fixed'::text, 'hourly'::text, 'milestone'::text, 'negotiable'::text])),
  deliverables text,
  responsibilities text,
  apply_url text,
  apply_email text,
  contact_email text,
  budget text,
  deadline timestamp with time zone,
  duration text,
  skills_required ARRAY DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  facilitator_id uuid,
  startup_id uuid,
  visibility text NOT NULL DEFAULT 'public'::text CHECK (visibility = ANY (ARRAY['public'::text, 'email_restricted'::text, 'facilitator_only'::text])),
  target_facilitator_ids ARRAY,
  CONSTRAINT gigs_pkey PRIMARY KEY (id),
  CONSTRAINT gigs_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.admin_profiles(id),
  CONSTRAINT gigs_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.inapp_notification (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  recipient_id uuid NOT NULL,
  type text NOT NULL,
  post_id uuid,
  reply_id uuid,
  actor_id uuid,
  actor_name text,
  actor_avatar_url text,
  actor_username text,
  content text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  extra jsonb,
  CONSTRAINT inapp_notification_pkey PRIMARY KEY (id),
  CONSTRAINT inapp_notification_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT inapp_notification_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id),
  CONSTRAINT inapp_notification_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES public.posts(id),
  CONSTRAINT inapp_notification_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id)
);
CREATE TABLE public.investor_deal_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type = ANY (ARRAY['stage_change'::text, 'note_added'::text, 'meeting_scheduled'::text, 'document_shared'::text, 'message'::text])),
  from_stage text,
  to_stage text,
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT investor_deal_activity_pkey PRIMARY KEY (id),
  CONSTRAINT investor_deal_activity_deal_fkey FOREIGN KEY (deal_id) REFERENCES public.investor_deals(id),
  CONSTRAINT investor_deal_activity_actor_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id)
);
CREATE TABLE public.investor_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  stage text NOT NULL DEFAULT 'watching'::text CHECK (stage = ANY (ARRAY['watching'::text, 'interested'::text, 'in_talks'::text, 'due_diligence'::text, 'invested'::text, 'referred'::text, 'passed'::text])),
  notes text,
  invested_amount text,
  invested_date date,
  instrument text CHECK (instrument IS NULL OR (instrument = ANY (ARRAY['safe'::text, 'equity'::text, 'convertible_note'::text, 'other'::text]))),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT investor_deals_pkey PRIMARY KEY (id),
  CONSTRAINT investor_deals_investor_fkey FOREIGN KEY (investor_id) REFERENCES public.users(id),
  CONSTRAINT investor_deals_startup_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.investor_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  firm_name text,
  investor_type text CHECK (investor_type IS NULL OR (investor_type = ANY (ARRAY['angel'::text, 'vc'::text, 'family_office'::text, 'accelerator'::text, 'corporate_vc'::text, 'scout'::text, 'syndicate_lead'::text, 'government'::text]))),
  check_size_min text,
  check_size_max text,
  preferred_stages ARRAY DEFAULT '{}'::text[],
  preferred_sectors ARRAY DEFAULT '{}'::text[],
  portfolio_count integer DEFAULT 0,
  thesis text,
  linkedin text,
  website text,
  location text,
  is_actively_investing boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  affiliated_fund text,
  CONSTRAINT investor_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT investor_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  company text NOT NULL,
  description text,
  is_external boolean NOT NULL DEFAULT false,
  external_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  deadline timestamp with time zone,
  is_active boolean DEFAULT true,
  location text,
  salary_range text,
  job_type text NOT NULL DEFAULT 'full-time'::text,
  requirements text,
  updated_at timestamp with time zone DEFAULT now(),
  company_logo_url text,
  company_website text,
  experience_level text DEFAULT 'any'::text CHECK (experience_level = ANY (ARRAY['any'::text, 'internship'::text, 'entry'::text, 'mid'::text, 'senior'::text, 'lead'::text, 'executive'::text])),
  skills_required ARRAY DEFAULT '{}'::text[],
  benefits text,
  responsibilities text,
  category text DEFAULT 'other'::text CHECK (category = ANY (ARRAY['engineering'::text, 'design'::text, 'marketing'::text, 'sales'::text, 'operations'::text, 'finance'::text, 'hr'::text, 'legal'::text, 'product'::text, 'data'::text, 'support'::text, 'content'::text, 'other'::text])),
  work_mode text DEFAULT 'onsite'::text CHECK (work_mode = ANY (ARRAY['onsite'::text, 'remote'::text, 'hybrid'::text])),
  apply_url text,
  apply_email text,
  contact_email text,
  facilitator_id uuid,
  startup_id uuid,
  visibility text NOT NULL DEFAULT 'public'::text CHECK (visibility = ANY (ARRAY['public'::text, 'facilitator_only'::text])),
  target_facilitator_ids ARRAY,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.admin_profiles(id),
  CONSTRAINT jobs_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.leaderboard_entries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  leaderboard_period_id uuid NOT NULL,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  points integer NOT NULL DEFAULT 0,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  position integer,
  CONSTRAINT leaderboard_entries_pkey PRIMARY KEY (id),
  CONSTRAINT leaderboard_entries_period_fkey FOREIGN KEY (leaderboard_period_id) REFERENCES public.leaderboard_periods(id),
  CONSTRAINT leaderboard_entries_project_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT leaderboard_entries_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.leaderboard_periods (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['monthly'::text, 'competition'::text, 'annual'::text, 'weekly'::text])),
  competition_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_periods_pkey PRIMARY KEY (id),
  CONSTRAINT leaderboard_periods_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id)
);
CREATE TABLE public.licenses_certificates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  title text NOT NULL,
  issuer text NOT NULL,
  issue_date date NOT NULL,
  expiration_date date,
  credential_id text,
  credential_url text,
  CONSTRAINT licenses_certificates_pkey PRIMARY KEY (id),
  CONSTRAINT licenses_certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.mentor_categories (
  mentor_id uuid NOT NULL,
  category_id uuid NOT NULL,
  CONSTRAINT mentor_categories_pkey PRIMARY KEY (mentor_id, category_id),
  CONSTRAINT mentor_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT mentor_categories_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.mentors(id)
);
CREATE TABLE public.mentors (
  id uuid NOT NULL,
  average_rating numeric DEFAULT 0,
  CONSTRAINT mentors_pkey PRIMARY KEY (id),
  CONSTRAINT mentors_id_fkey FOREIGN KEY (id) REFERENCES public.users(id)
);
CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT message_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone,
  is_read boolean DEFAULT false,
  reply_to_id uuid,
  last_edited_at timestamp with time zone,
  message_type text NOT NULL DEFAULT 'text'::text CHECK (message_type = ANY (ARRAY['text'::text, 'post_share'::text, 'profile_share'::text, 'voice_note'::text, 'image'::text, 'video'::text, 'file'::text])),
  metadata jsonb,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.messages(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false,
  actor_id uuid,
  actor_username text,
  actor_avatar_url text,
  content text,
  reference_id uuid,
  reference_type text,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id),
  CONSTRAINT notifications_reference_id_fkey FOREIGN KEY (reference_id) REFERENCES public.messages(id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  path_tokens ARRAY DEFAULT string_to_array(name, '/'::text),
  version text,
  CONSTRAINT objects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.points_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  leaderboard_entry_id uuid NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT points_history_pkey PRIMARY KEY (id),
  CONSTRAINT points_history_leaderboard_entry_fkey FOREIGN KEY (leaderboard_entry_id) REFERENCES public.leaderboard_entries(id)
);
CREATE TABLE public.portfolio_platforms (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  portfolio_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform = ANY (ARRAY['github'::text, 'figma'::text, 'dribbble'::text, 'behance'::text, 'linkedin'::text, 'youtube'::text, 'notion'::text, 'substack'::text, 'custom'::text])),
  link text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT portfolio_platforms_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_platforms_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id)
);
CREATE TABLE public.portfolios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT portfolios_pkey PRIMARY KEY (id),
  CONSTRAINT portfolios_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.positions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  experience_id uuid NOT NULL,
  position text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT positions_pkey PRIMARY KEY (id),
  CONSTRAINT positions_experience_id_fkey FOREIGN KEY (experience_id) REFERENCES public.work_experiences(id)
);
CREATE TABLE public.post_features (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE,
  engagement_score double precision NOT NULL DEFAULT 0,
  virality_velocity double precision NOT NULL DEFAULT 0,
  like_rate double precision NOT NULL DEFAULT 0,
  reply_rate double precision NOT NULL DEFAULT 0,
  share_rate double precision NOT NULL DEFAULT 0,
  avg_dwell_ms double precision NOT NULL DEFAULT 0,
  ctr double precision NOT NULL DEFAULT 0,
  content_quality double precision NOT NULL DEFAULT 0.5,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_features_pkey PRIMARY KEY (id)
);
CREATE TABLE public.post_likes (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id),
  CONSTRAINT post_likes_post_fk FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_likes_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.post_media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type = ANY (ARRAY['photo'::text, 'video'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  media_thumbnail text,
  width integer,
  height integer,
  CONSTRAINT post_media_pkey PRIMARY KEY (id),
  CONSTRAINT post_media_post_fk FOREIGN KEY (post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.post_poll_options (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  poll_id uuid NOT NULL,
  option_text text NOT NULL,
  votes integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  CONSTRAINT post_poll_options_pkey PRIMARY KEY (id),
  CONSTRAINT post_poll_options_poll_fk FOREIGN KEY (poll_id) REFERENCES public.post_polls(id)
);
CREATE TABLE public.post_poll_votes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  poll_option_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_poll_votes_pkey PRIMARY KEY (id),
  CONSTRAINT post_poll_votes_poll_option_fk FOREIGN KEY (poll_option_id) REFERENCES public.post_poll_options(id),
  CONSTRAINT post_poll_votes_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.post_polls (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL UNIQUE,
  question text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  poll_type text NOT NULL DEFAULT 'single_choice'::text CHECK (poll_type = ANY (ARRAY['single_choice'::text, 'multiple_choice'::text])),
  CONSTRAINT post_polls_pkey PRIMARY KEY (id),
  CONSTRAINT post_polls_post_fk FOREIGN KEY (post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.post_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reporter_id uuid NOT NULL,
  reported_post_id uuid NOT NULL,
  reason text NOT NULL,
  additional_info text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'closed'::text, 'action_taken'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  moderator_id uuid,
  moderator_notes text,
  CONSTRAINT post_reports_pkey PRIMARY KEY (id),
  CONSTRAINT post_reports_moderator_fk FOREIGN KEY (moderator_id) REFERENCES public.users(id),
  CONSTRAINT post_reports_reported_post_fk FOREIGN KEY (reported_post_id) REFERENCES public.posts(id),
  CONSTRAINT post_reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES public.users(id)
);
CREATE TABLE public.post_reposts (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_reposts_pkey PRIMARY KEY (post_id, user_id),
  CONSTRAINT post_reposts_post_fk FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_reposts_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  author_id uuid NOT NULL,
  environment_id uuid NOT NULL,
  parent_post_id uuid,
  content text,
  post_type text NOT NULL CHECK (post_type = ANY (ARRAY['text'::text, 'media'::text, 'poll'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false,
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_author_fk FOREIGN KEY (author_id) REFERENCES public.users(id),
  CONSTRAINT posts_environment_fk FOREIGN KEY (environment_id) REFERENCES public.environments(id),
  CONSTRAINT posts_parent_fk FOREIGN KEY (parent_post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.project_collabs (
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['editor'::text, 'viewer'::text, 'admin'::text])),
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])),
  CONSTRAINT project_collabs_pkey PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_collabs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_collabs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.project_fields (
  project_id uuid NOT NULL,
  field_key text NOT NULL,
  field_value text,
  CONSTRAINT project_fields_pkey PRIMARY KEY (project_id, field_key),
  CONSTRAINT project_fields_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_followers (
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  followed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_followers_pkey PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_followers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.project_links (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  icon_name text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_links_pkey PRIMARY KEY (id),
  CONSTRAINT project_links_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_slides (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  slide_url text NOT NULL,
  caption text,
  slide_number integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_slides_pkey PRIMARY KEY (id),
  CONSTRAINT project_slides_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_text_sections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  heading text NOT NULL,
  content text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_text_sections_pkey PRIMARY KEY (id),
  CONSTRAINT project_text_sections_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_upvotes (
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_upvotes_pkey PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_upvotes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_upvotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  tagline text,
  cover_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  visibility text NOT NULL DEFAULT 'public'::text CHECK (visibility = ANY (ARRAY['public'::text, 'private'::text, 'unlisted'::text])),
  logo_url text,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id)
);
CREATE TABLE public.report_reasons (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reason_text text NOT NULL,
  category text,
  severity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT report_reasons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text,
  icon text,
  category text NOT NULL DEFAULT 'tool'::text CHECK (category = ANY (ARRAY['govt_scheme'::text, 'accelerator_incubator'::text, 'company_offer'::text, 'tool'::text, 'bank_offer'::text, 'scheme'::text])),
  provider text,
  eligibility text,
  deadline timestamp with time zone,
  tags ARRAY DEFAULT '{}'::text[],
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  logo_url text,
  CONSTRAINT resources_pkey PRIMARY KEY (id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  mentor_id uuid,
  reviewer_id uuid,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.mentors(id),
  CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id)
);
CREATE TABLE public.saved_competitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  competition_id uuid NOT NULL,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT saved_competitions_pkey PRIMARY KEY (id),
  CONSTRAINT saved_competitions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT saved_competitions_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id)
);
CREATE TABLE public.saved_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT saved_events_pkey PRIMARY KEY (id),
  CONSTRAINT saved_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT saved_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.startup_awards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  award_name text NOT NULL,
  year integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT startup_awards_pkey PRIMARY KEY (id),
  CONSTRAINT startup_awards_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.startup_bookmarks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT startup_bookmarks_pkey PRIMARY KEY (id),
  CONSTRAINT startup_bookmarks_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.startup_facilitator_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  facilitator_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text])),
  assigned_by uuid,
  notes text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT startup_facilitator_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT startup_facilitator_assignments_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id),
  CONSTRAINT startup_facilitator_assignments_facilitator_id_fkey FOREIGN KEY (facilitator_id) REFERENCES public.admin_profiles(id),
  CONSTRAINT startup_facilitator_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.admin_profiles(id)
);
CREATE TABLE public.startup_founders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  ments_username text,
  status text DEFAULT 'accepted'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])),
  email text,
  avatar_url text,
  role text,
  CONSTRAINT startup_founders_pkey PRIMARY KEY (id),
  CONSTRAINT startup_founders_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id),
  CONSTRAINT startup_founders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.startup_funding_rounds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  investor text,
  amount text,
  round_type text CHECK (round_type = ANY (ARRAY['pre_seed'::text, 'seed'::text, 'series_a'::text, 'series_b'::text, 'series_c'::text, 'other'::text])),
  round_date date,
  is_public boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT startup_funding_rounds_pkey PRIMARY KEY (id),
  CONSTRAINT startup_funding_rounds_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.startup_incubators (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  program_name text NOT NULL,
  year integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT startup_incubators_pkey PRIMARY KEY (id),
  CONSTRAINT startup_incubators_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.startup_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  icon_name text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT startup_links_pkey PRIMARY KEY (id),
  CONSTRAINT startup_links_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.startup_profile_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  viewer_id uuid,
  viewed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT startup_profile_views_pkey PRIMARY KEY (id),
  CONSTRAINT startup_profile_views_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.startup_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  brand_name text NOT NULL,
  registered_name text,
  legal_status text NOT NULL CHECK (legal_status = ANY (ARRAY['llp'::text, 'pvt_ltd'::text, 'sole_proprietorship'::text, 'not_registered'::text])),
  cin text,
  stage text NOT NULL CHECK (stage = ANY (ARRAY['ideation'::text, 'mvp'::text, 'scaling'::text, 'expansion'::text, 'maturity'::text])),
  description text,
  keywords ARRAY DEFAULT '{}'::text[],
  website text,
  founded_date date,
  startup_email text,
  startup_phone text,
  pitch_deck_url text,
  is_actively_raising boolean DEFAULT false,
  visibility text DEFAULT 'public'::text CHECK (visibility = ANY (ARRAY['public'::text, 'investors_only'::text, 'private'::text])),
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_featured boolean NOT NULL DEFAULT false,
  business_model text,
  city text,
  country text,
  categories ARRAY DEFAULT '{}'::text[],
  team_size text,
  key_strengths text,
  target_audience text,
  elevator_pitch text,
  revenue_amount text,
  revenue_currency text,
  revenue_growth text,
  traction_metrics text,
  total_raised text,
  investor_count integer,
  logo_url text,
  banner_url text,
  address_line1 text,
  address_line2 text,
  state text,
  raise_target text,
  equity_offered text,
  min_ticket_size text,
  funding_stage text CHECK (funding_stage IS NULL OR (funding_stage = ANY (ARRAY['pre_seed'::text, 'seed'::text, 'series_a'::text, 'series_b'::text, 'series_c'::text, 'bridge'::text]))),
  sector text,
  entity_type text NOT NULL DEFAULT 'startup'::text CHECK (entity_type = ANY (ARRAY['org_project'::text, 'startup'::text])),
  parent_org_id uuid,
  CONSTRAINT startup_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT startup_profiles_parent_org_id_fkey FOREIGN KEY (parent_org_id) REFERENCES public.users(id)
);
CREATE TABLE public.startup_slides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  slide_url text NOT NULL,
  caption text,
  slide_number integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT startup_slides_pkey PRIMARY KEY (id),
  CONSTRAINT startup_slides_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.startup_text_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  heading text NOT NULL,
  content text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT startup_text_sections_pkey PRIMARY KEY (id),
  CONSTRAINT startup_text_sections_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
CREATE TABLE public.startup_upvotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT startup_upvotes_pkey PRIMARY KEY (id),
  CONSTRAINT startup_upvotes_startup_id_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id),
  CONSTRAINT startup_upvotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.trending_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE,
  status text NOT NULL CHECK (status = ANY (ARRAY['pinned'::text, 'removed'::text])),
  pinned_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT trending_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT trending_overrides_pinned_by_fkey FOREIGN KEY (pinned_by) REFERENCES auth.users(id),
  CONSTRAINT trending_overrides_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.trending_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  topic text NOT NULL UNIQUE,
  post_count integer NOT NULL DEFAULT 0,
  engagement_sum double precision NOT NULL DEFAULT 0,
  velocity double precision NOT NULL DEFAULT 0,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'rising'::text CHECK (status = ANY (ARRAY['rising'::text, 'trending'::text, 'declining'::text])),
  CONSTRAINT trending_topics_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.users(id),
  CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_devices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  fcm_token text NOT NULL,
  device_info text,
  created_at timestamp with time zone DEFAULT now(),
  app_version text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_devices_pkey PRIMARY KEY (id),
  CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_follows (
  follower_id uuid NOT NULL,
  followee_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_follows_pkey PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT user_follows_followee_id_fkey FOREIGN KEY (followee_id) REFERENCES public.users(id),
  CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_interaction_graph (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  interaction_count integer NOT NULL DEFAULT 0,
  affinity_score double precision NOT NULL DEFAULT 0,
  last_interaction_at timestamp with time zone NOT NULL DEFAULT now(),
  interaction_types jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT user_interaction_graph_pkey PRIMARY KEY (id),
  CONSTRAINT user_interaction_graph_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_interest_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  topic_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_type_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  creator_affinities jsonb NOT NULL DEFAULT '{}'::jsonb,
  interaction_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_interest_profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  reason text NOT NULL,
  additional_info text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'closed'::text, 'action_taken'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  moderator_id uuid,
  moderator_notes text,
  CONSTRAINT user_reports_pkey PRIMARY KEY (id),
  CONSTRAINT user_reports_moderator_fk FOREIGN KEY (moderator_id) REFERENCES public.users(id),
  CONSTRAINT user_reports_reported_user_fk FOREIGN KEY (reported_user_id) REFERENCES public.users(id),
  CONSTRAINT user_reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_sessions (
  id text NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  last_active_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  device_type text,
  events_count integer NOT NULL DEFAULT 0,
  feed_depth integer NOT NULL DEFAULT 0,
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  full_name text NOT NULL,
  about text,
  current_city text,
  tagline text,
  user_type text NOT NULL CHECK (user_type = ANY (ARRAY['normal_user'::text, 'mentor'::text, 'founder'::text, 'investor'::text, 'explorer'::text])),
  created_at timestamp with time zone DEFAULT now(),
  avatar_url text,
  banner_image text,
  is_verified boolean NOT NULL DEFAULT false,
  fcm_token text,
  is_onboarding_done boolean NOT NULL DEFAULT false,
  last_seen timestamp with time zone DEFAULT now(),
  role text NOT NULL DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'super_admin'::text])),
  onboarding_step integer DEFAULT 0,
  skills ARRAY DEFAULT '{}'::text[],
  primary_interest text DEFAULT 'exploring'::text CHECK (primary_interest = ANY (ARRAY['exploring'::text, 'building'::text, 'investing'::text])),
  investor_status text DEFAULT 'none'::text CHECK (investor_status = ANY (ARRAY['none'::text, 'applied'::text, 'verified'::text, 'rejected'::text])),
  investor_verified_at timestamp with time zone,
  looking_for ARRAY DEFAULT '{}'::text[],
  linkedin text,
  account_status text NOT NULL DEFAULT 'active'::text CHECK (account_status = ANY (ARRAY['active'::text, 'deactivated'::text, 'suspended'::text, 'deleted'::text])),
  status_reason text,
  status_changed_at timestamp with time zone DEFAULT now(),
  status_changed_by uuid,
  social_links jsonb,
  show_projects boolean NOT NULL DEFAULT true,
  show_startups boolean NOT NULL DEFAULT true,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT verification_codes_pkey PRIMARY KEY (id),
  CONSTRAINT verification_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.work_experiences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  company_name text NOT NULL,
  domain text,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT work_experiences_pkey PRIMARY KEY (id),
  CONSTRAINT work_experiences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);