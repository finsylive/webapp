# Supabase Database Schema — Tables, RPC Functions & Columns

> Auto-generated from codebase analysis of all `.from('...')` and `.rpc('...')` calls.

---

## All Tables (54 tables)

| # | Table Name | Primary Domain |
|---|-----------|----------------|
| 1 | `users` | Auth / Profile |
| 2 | `user_follows` | Social |
| 3 | `verification_codes` | Auth |
| 4 | `posts` | Feed |
| 5 | `post_likes` | Feed |
| 6 | `post_media` | Feed |
| 7 | `post_reposts` | Feed |
| 8 | `post_reports` | Feed / Moderation |
| 9 | `post_polls` | Feed / Polls |
| 10 | `post_poll_options` | Feed / Polls |
| 11 | `post_poll_votes` | Feed / Polls |
| 12 | `environments` | Communities |
| 13 | `trending_overrides` | Feed / Moderation |
| 14 | `work_experiences` | Profile |
| 15 | `positions` | Profile |
| 16 | `education` | Profile |
| 17 | `projects` | Profile / Portfolio |
| 18 | `project_text_sections` | Projects |
| 19 | `project_slides` | Projects |
| 20 | `project_links` | Projects |
| 21 | `portfolios` | Profile / Portfolio |
| 22 | `portfolio_platforms` | Profile / Portfolio |
| 23 | `startup_profiles` | Startups |
| 24 | `startup_founders` | Startups |
| 25 | `startup_funding_rounds` | Startups |
| 26 | `startup_incubators` | Startups |
| 27 | `startup_awards` | Startups |
| 28 | `startup_bookmarks` | Startups |
| 29 | `startup_profile_views` | Startups |
| 30 | `conversations` | Messaging |
| 31 | `messages` | Messaging |
| 32 | `message_reactions` | Messaging |
| 33 | `chat_categories` | Messaging |
| 34 | `conversation_categories` | Messaging |
| 35 | `notifications` | Notifications (legacy) |
| 36 | `inapp_notification` | Notifications (new) |
| 37 | `jobs` | Jobs / Gigs |
| 38 | `gigs` | Jobs / Gigs |
| 39 | `applications` | Jobs / Gigs |
| 40 | `competitions` | Competitions |
| 41 | `competition_entries` | Competitions |
| 42 | `resources` | Resources |
| 43 | `feed_cache` | Feed Engine |
| 44 | `feed_events` | Feed Engine |
| 45 | `feed_seen_posts` | Feed Engine |
| 46 | `feed_experiments` | Feed Engine |
| 47 | `feed_experiment_assignments` | Feed Engine |
| 48 | `feed_analytics_daily` | Feed Engine |
| 49 | `post_features` | Feed Engine |
| 50 | `content_embeddings` | Feed Engine |
| 51 | `user_interest_profiles` | Feed Engine |
| 52 | `user_interaction_graph` | Feed Engine |
| 53 | `user_sessions` | Feed Engine |

> **Storage bucket**: `media` (used via `supabase.storage.from('media')` — not a DB table)

---

## All RPC Functions (10 functions)

| # | RPC Function | Parameters | Source File |
|---|-------------|------------|-------------|
| 1 | `get_posts_with_counts` | various | `src/api/posts.ts` |
| 2 | `get_post_with_counts` | various | `src/api/posts.ts` |
| 3 | `like_post` | various | `src/api/posts.ts` |
| 4 | `unlike_post` | various | `src/api/posts.ts` |
| 5 | `get_unread_message_count` | `{ user_id }` | `src/app/api/messages/read/route.ts` |
| 6 | `compute_post_features` | `{ p_post_id }` | `src/app/api/feed/extract-topics/route.ts` |
| 7 | `batch_insert_feed_events` | `{ events }` (JSON string) | `src/app/api/feed/events/route.ts` |
| 8 | `update_interaction_graph` | `{ p_user_id, p_target_user_id, p_event_type }` | `src/app/api/feed/events/route.ts` |
| 9 | `get_feed_candidates` | `{ p_user_id, p_limit, p_max_age_hours }` | `src/lib/feed/candidate-generator.ts` |
| 10 | `compute_user_interest_profile` | `{ p_user_id }` | `src/lib/feed/interest-profile.ts` |

---

## Column Details Per Table

### 1. `users`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | Matches auth.users.id |
| `username` | text | Unique |
| `email` | text | From auth |
| `full_name` | text | |
| `avatar_url` | text | |
| `banner_image` | text | |
| `tagline` | text | |
| `current_city` | text | |
| `user_type` | text | `'explorer' \| 'investor' \| 'founder'` |
| `is_verified` | boolean | |
| `is_onboarding_done` | boolean | |
| `about` | text | Bio / about me |
| `skills` | text[] | Array of skill strings |
| `created_at` | timestamptz | |
| `last_seen` | timestamptz | |

### 2. `user_follows`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `follower_id` | uuid (FK → users) | |
| `followee_id` | uuid (FK → users) | |

### 3. `verification_codes`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `code` | text | 6-digit string |
| `expires_at` | timestamptz | |
| `used` | boolean | |
| `created_at` | timestamptz | |

### 4. `posts`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `author_id` | uuid (FK → users) | |
| `environment_id` | uuid (FK → environments) | |
| `content` | text | |
| `post_type` | text | `'text' \| 'media' \| 'poll'` |
| `parent_post_id` | uuid (FK → posts, nullable) | For replies/threads |
| `deleted` | boolean | Soft delete |
| `created_at` | timestamptz | |
| `user_id` | uuid | (Possibly alias/legacy for author_id, seen in search) |

### 5. `post_likes`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `post_id` | uuid (FK → posts) | |
| `user_id` | uuid (FK → users) | |

### 6. `post_media`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `post_id` | uuid (FK → posts) | |
| `media_url` | text | |
| `media_type` | text | |
| `media_thumbnail` | text | |
| `width` | integer | |
| `height` | integer | |

### 7. `post_reposts`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| *(queried with `select('*')`)* | | |

### 8. `post_reports`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| *(queried with `select('*')`)* | | |

### 9. `post_polls`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `post_id` | uuid (FK → posts) | |
| `question` | text | |
| `poll_type` | text | `'single_choice' \| 'multiple_choice'` |

### 10. `post_poll_options`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `poll_id` | uuid (FK → post_polls) | |
| `option_text` | text | |
| `position` | integer | Display order |
| `votes` | integer | Denormalized count |

### 11. `post_poll_votes`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `poll_option_id` | uuid (FK → post_poll_options) | |
| `user_id` | uuid (FK → users) | |
| `created_at` | timestamptz | |

### 12. `environments`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `name` | text | |
| `description` | text | |
| `picture` | text | Icon/avatar URL |
| `banner` | text | Banner image URL |
| `created_at` | timestamptz | |

### 13. `trending_overrides`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `post_id` | uuid (FK → posts) | |
| `status` | text | Admin override status |

### 14. `work_experiences`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `company_name` | text | |
| `domain` | text | Company domain/industry |
| `sort_order` | integer | |

### 15. `positions`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `experience_id` | uuid (FK → work_experiences) | |
| `position` | text | Job title |
| `start_date` | date/text | |
| `end_date` | date/text (nullable) | |
| `description` | text | |
| `sort_order` | integer | |

### 16. `education`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `institution_name` | text | |
| `institution_domain` | text | |
| `degree` | text | |
| `field_of_study` | text | |
| `start_date` | date/text | |
| `end_date` | date/text (nullable) | |
| `description` | text | |
| `sort_order` | integer | |

### 17. `projects`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `owner_id` | uuid (FK → users) | |
| `title` | text | |
| `category` | text/uuid | |
| `tagline` | text | |
| `description` | text | |
| `cover_url` | text | |
| `logo_url` | text | |
| `visibility` | text | `'public' \| 'private' \| 'unlisted'` |
| `tech_stack` | text[] | |
| `created_at` | timestamptz | |

### 18. `project_text_sections`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `project_id` | uuid (FK → projects) | |
| *(other columns queried with `select('*')`)* | | |

### 19. `project_slides`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `project_id` | uuid (FK → projects) | |
| `sort_order` | integer | Used in normalize route |
| *(other columns queried with `select('*')`)* | | |

### 20. `project_links`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `project_id` | uuid (FK → projects) | |
| *(other columns queried with `select('*')`)* | | |

### 21. `portfolios`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `created_at` | timestamptz | |
| *(other columns queried with `select('*')`)* | | |

### 22. `portfolio_platforms`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `portfolio_id` | uuid (FK → portfolios) | |
| `platform` | text | |
| `link` | text | |

### 23. `startup_profiles`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `owner_id` | uuid (FK → users) | |
| `brand_name` | text | |
| `registered_name` | text | |
| `legal_status` | text | `'llp' \| 'pvt_ltd' \| 'sole_proprietorship' \| 'not_registered'` |
| `cin` | text | Corporate ID number |
| `stage` | text | `'ideation' \| 'mvp' \| 'scaling' \| 'expansion' \| 'maturity'` |
| `description` | text | |
| `keywords` | text[] | |
| `website` | text | |
| `founded_date` | date/text | |
| `address_line1` | text | |
| `address_line2` | text | |
| `state` | text | |
| `startup_email` | text | |
| `startup_phone` | text | |
| `pitch_deck_url` | text | |
| `is_actively_raising` | boolean | |
| `visibility` | text | `'public' \| 'investors_only' \| 'private'` |
| `is_published` | boolean | |
| `is_featured` | boolean | |
| `business_model` | text | |
| `city` | text | |
| `country` | text | |
| `categories` | text[] | |
| `team_size` | text | |
| `key_strengths` | text | |
| `target_audience` | text | |
| `revenue_amount` | text | |
| `revenue_currency` | text | |
| `revenue_growth` | text | |
| `traction_metrics` | text | |
| `total_raised` | text | |
| `investor_count` | integer | |
| `elevator_pitch` | text | |
| `logo_url` | text | |
| `banner_url` | text | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 24. `startup_founders`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `startup_id` | uuid (FK → startup_profiles) | |
| `name` | text | |
| `role` | text | |
| `linkedin_url` | text | |
| `email` | text | For non-Ments founders only |
| `user_id` | uuid (FK → users, nullable) | |
| `ments_username` | text | |
| `avatar_url` | text | |
| `status` | text | `'pending' \| 'accepted' \| 'declined'` |
| `display_order` | integer | |
| `created_at` | timestamptz | |

### 25. `startup_funding_rounds`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `startup_id` | uuid (FK → startup_profiles) | |
| `investor` | text | |
| `amount` | text | |
| `round_type` | text | `'pre_seed' \| 'seed' \| 'series_a' \| 'series_b' \| 'series_c' \| 'other'` |
| `round_date` | date/text | |
| `is_public` | boolean | |
| `created_at` | timestamptz | |

### 26. `startup_incubators`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `startup_id` | uuid (FK → startup_profiles) | |
| `program_name` | text | |
| `year` | date/text | Stored as `YYYY-01-01` |
| `created_at` | timestamptz | |

### 27. `startup_awards`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `startup_id` | uuid (FK → startup_profiles) | |
| `award_name` | text | |
| `year` | date/text | Stored as `YYYY-01-01` |
| `created_at` | timestamptz | |

### 28. `startup_bookmarks`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `startup_id` | uuid (FK → startup_profiles) | |

### 29. `startup_profile_views`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `startup_id` | uuid (FK → startup_profiles) | |
| `viewer_id` | uuid (FK → users, nullable) | |

### 30. `conversations`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `user1_id` | uuid (FK → users) | |
| `user2_id` | uuid (FK → users) | |
| `last_message` | text | Denormalized |
| `status` | text | `'pending' \| 'approved' \| 'rejected'` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 31. `messages`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `conversation_id` | uuid (FK → conversations) | |
| `sender_id` | uuid (FK → users) | |
| `content` | text | |
| `reply_to_id` | uuid (FK → messages, nullable) | |
| `media_url` | text | |
| `is_read` | boolean | |
| `read_at` | timestamptz | |
| `created_at` | timestamptz | |

### 32. `message_reactions`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `message_id` | uuid (FK → messages) | |
| `user_id` | uuid (FK → users) | |
| `reaction` | text | Emoji/reaction type |
| *unique constraint* | | `(user_id, message_id)` |

### 33. `chat_categories`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |

### 34. `conversation_categories`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `conversation_id` | uuid (FK → conversations) | |
| `category_id` | uuid (FK → chat_categories) | |
| `created_at` | timestamptz | |

### 35. `notifications` (legacy)
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `type` | text | |
| `message` | text | |
| `read` | boolean | |
| `data` | jsonb | Additional context |
| `created_at` | timestamptz | |

### 36. `inapp_notification`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `recipient_id` | uuid (FK → users) | |
| `type` | text | e.g. `'cofounder_request'` |
| `content` | text | |
| `is_read` | boolean | |
| `actor_id` | uuid (FK → users) | |
| `actor_name` | text | Denormalized |
| `actor_avatar_url` | text | Denormalized |
| `actor_username` | text | Denormalized |
| `extra` | jsonb | Additional context |
| `created_at` | timestamptz | |

### 37. `jobs`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `title` | text | |
| `company` | text | |
| `description` | text | |
| `location` | text | |
| `job_type` | text | e.g. `'full-time'` |
| `salary_range` | text | |
| `is_active` | boolean | |
| `category` | text | |
| `experience_level` | text | |
| `work_mode` | text | |
| `skills_required` | text[] | |
| `requirements` | text | |
| `responsibilities` | text | |
| `deadline` | timestamptz | |
| `created_at` | timestamptz | |

### 38. `gigs`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `title` | text | |
| `company` | text | |
| `description` | text | |
| `budget` | text | |
| `deadline` | timestamptz | |
| `is_active` | boolean | |
| `category` | text | |
| `experience_level` | text | |
| `payment_type` | text | e.g. `'fixed'` |
| `duration` | text | |
| `skills_required` | text[] | |
| `deliverables` | text | |
| `responsibilities` | text | |
| `created_at` | timestamptz | |

### 39. `applications`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `job_id` | uuid (FK → jobs, nullable) | |
| `gig_id` | uuid (FK → gigs, nullable) | |
| `user_id` | uuid (FK → users) | |
| `user_name` | text | Denormalized snapshot |
| `user_email` | text | Denormalized |
| `user_avatar_url` | text | Denormalized |
| `user_tagline` | text | Denormalized |
| `user_city` | text | Denormalized |
| `profile_snapshot` | jsonb | Full profile at time of application |
| `match_score` | integer | AI-computed 0-100 |
| `match_breakdown` | jsonb | `{ skills, experience, level, overall }` |
| `profile_summary` | text | AI-generated |
| `strengths` | text[] | AI-identified |
| `weaknesses` | text[] | AI-identified |
| `ai_questions` | jsonb | Array of Q&A objects |
| `status` | text | `'in_progress' \| 'submitted' \| 'cancelled'` |
| `interview_score` | integer | 0-100 |
| `overall_score` | integer | 0-100 (weighted) |
| `ai_recommendation` | text | `'strongly_recommend' \| 'recommend' \| 'maybe' \| 'not_recommend'` |
| `ai_summary` | text | |
| `hire_suggestion` | text | |
| `tab_switch_count` | integer | Anti-cheat metric |
| `time_spent_seconds` | integer | |
| `submitted_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `created_at` | timestamptz | (implied) |

### 40. `competitions`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `title` | text | |
| `description` | text | |
| `start_date` | timestamptz | |
| `end_date` | timestamptz | |
| `deadline` | timestamptz | |
| `banner_url` | text | |
| `prize` | text | |
| `created_at` | timestamptz | |

### 41. `competition_entries`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `competition_id` | uuid (FK → competitions) | |
| `submitted_by` | uuid (FK → users) | |
| `project_id` | uuid (FK → projects, nullable) | |
| *unique constraint* | | `(competition_id, submitted_by)` |

### 42. `resources`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `is_active` | boolean | |
| `category` | text | |
| `created_at` | timestamptz | |
| *(other columns queried with `select('*')`)* | | |

### 43. `feed_cache`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `user_id` | uuid (FK → users) | |
| `post_ids` | text[] | Ordered ranked post IDs |
| `scores` | float[] | Parallel scores array |
| `computed_at` | timestamptz | |
| `expires_at` | timestamptz | TTL |
| `version` | integer | Schema version |
| `experiment_id` | text (nullable) | |
| `variant` | text (nullable) | |

### 44. `feed_events`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `event_type` | text | `'impression' \| 'click' \| 'like' \| 'reply' \| 'share' \| 'bookmark' \| 'dwell' \| 'profile_click'` |
| `post_id` | uuid (FK → posts) | |
| `author_id` | uuid (FK → users) | |
| `metadata` | jsonb | e.g. `{ dwell_ms: number }` |
| `experiment_id` | text (nullable) | |
| `variant` | text (nullable) | |
| `created_at` | timestamptz | |

### 45. `feed_seen_posts`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `user_id` | uuid (FK → users) | |
| `post_id` | uuid (FK → posts) | |
| *unique constraint* | | `(user_id, post_id)` |

### 46. `feed_experiments`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | |
| `name` | text | |
| `description` | text | |
| `status` | text | `'draft' \| 'active' \| 'ended'` |
| `variants` | jsonb | Array of `{ id, config: Record<string,number> }` |
| `targeting_rules` | jsonb | |
| `metrics` | jsonb | |
| `created_at` | timestamptz | |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz | |

### 47. `feed_experiment_assignments`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `experiment_id` | uuid (FK → feed_experiments) | |
| `user_id` | uuid (FK → users) | |
| `variant_id` | text | |

### 48. `feed_analytics_daily`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `date` | date | |
| *(other columns queried with `select('*')`)* | | Aggregated daily metrics |

### 49. `post_features`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `post_id` | uuid (FK → posts) | |
| `engagement_score` | float | |
| *(other columns queried with `select('*')`)* | | |

### 50. `content_embeddings`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `post_id` | uuid (FK → posts, unique) | `onConflict: 'post_id'` |
| `topics` | text[] | Extracted topics |
| `keywords` | text[] | Extracted keywords |
| `sentiment` | text/float | |
| `language` | text | |
| `computed_at` | timestamptz | |

### 51. `user_interest_profiles`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `user_id` | uuid (FK → users) | |
| `topic_scores` | jsonb | `Record<string, number>` |
| `content_type_preferences` | jsonb | `Record<string, number>` |
| `creator_affinities` | jsonb | `Record<string, number>` |
| `computed_at` | timestamptz | |

### 52. `user_interaction_graph`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `user_id` | uuid (FK → users) | |
| `target_user_id` | uuid (FK → users) | |
| `affinity_score` | float | |

### 53. `user_sessions`
| Column | Type (inferred) | Notes |
|--------|----------------|-------|
| `id` | uuid (PK) | Client-generated |
| `user_id` | uuid (FK → users) | |
| `device_type` | text | |
| `started_at` | timestamptz | |
| `last_active_at` | timestamptz | |
| `ended_at` | timestamptz (nullable) | |
| `events_count` | integer | |
| `feed_depth` | integer | |

---

## Foreign Key Relationships (Supabase joins used in code)

```
users.id ← posts.author_id
users.id ← user_follows.follower_id / followee_id
users.id ← work_experiences.user_id
users.id ← education.user_id
users.id ← projects.owner_id
users.id ← portfolios.user_id
users.id ← startup_profiles.owner_id
users.id ← startup_founders.user_id
users.id ← startup_bookmarks.user_id
users.id ← conversations.user1_id / user2_id
users.id ← messages.sender_id
users.id ← notifications.user_id
users.id ← inapp_notification.recipient_id
users.id ← applications.user_id
users.id ← competition_entries.submitted_by
users.id ← post_likes.user_id
users.id ← post_poll_votes.user_id
users.id ← message_reactions.user_id
users.id ← chat_categories.user_id
users.id ← feed_events.user_id
users.id ← feed_cache.user_id
users.id ← feed_seen_posts.user_id
users.id ← user_sessions.user_id
users.id ← user_interest_profiles.user_id
users.id ← user_interaction_graph.user_id / target_user_id
users.id ← verification_codes.user_id

environments.id ← posts.environment_id

posts.id ← post_likes.post_id
posts.id ← post_media.post_id
posts.id ← post_polls.post_id
posts.id ← posts.parent_post_id  (self-referential for replies)
posts.id ← feed_events.post_id
posts.id ← feed_seen_posts.post_id
posts.id ← content_embeddings.post_id
posts.id ← post_features.post_id
posts.id ← trending_overrides.post_id

post_polls.id ← post_poll_options.poll_id
post_poll_options.id ← post_poll_votes.poll_option_id

work_experiences.id ← positions.experience_id

projects.id ← project_text_sections.project_id
projects.id ← project_slides.project_id
projects.id ← project_links.project_id
projects.id ← competition_entries.project_id

portfolios.id ← portfolio_platforms.portfolio_id

startup_profiles.id ← startup_founders.startup_id
startup_profiles.id ← startup_funding_rounds.startup_id
startup_profiles.id ← startup_incubators.startup_id
startup_profiles.id ← startup_awards.startup_id
startup_profiles.id ← startup_bookmarks.startup_id
startup_profiles.id ← startup_profile_views.startup_id

conversations.id ← messages.conversation_id
conversations.id ← conversation_categories.conversation_id

messages.id ← message_reactions.message_id
messages.id ← messages.reply_to_id  (self-referential for replies)

chat_categories.id ← conversation_categories.category_id

jobs.id ← applications.job_id
gigs.id ← applications.gig_id

competitions.id ← competition_entries.competition_id

feed_experiments.id ← feed_experiment_assignments.experiment_id
```
