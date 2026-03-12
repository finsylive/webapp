-- Seed Demo Startups
-- Run this in the Supabase SQL Editor.
-- Replace YOUR_USER_ID with your actual user UUID from auth.users.

-- NOTE: For logo_url and banner_url, upload images through the app's
-- Supabase storage first, or use any public image URL. The URLs below
-- use placeholder services — replace with real hosted images for best results.

DO $$
DECLARE
  _owner_id UUID := 'YOUR_USER_ID';  -- <-- REPLACE THIS
  _s1_id UUID;
  _s2_id UUID;
  _s3_id UUID;
  _s4_id UUID;
  _s5_id UUID;
BEGIN

-- 1. FinTech startup (Scaling, B2B, raising)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, registered_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  revenue_amount, revenue_currency, revenue_growth, traction_metrics,
  total_raised, investor_count, is_actively_raising, raise_target, equity_offered,
  min_ticket_size, funding_stage, sector,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'PayFlow', 'PayFlow Technologies Pvt. Ltd.', 'pvt_ltd', 'scaling',
  'PayFlow is building the payment infrastructure for emerging markets. We enable SMBs to accept digital payments with zero integration effort through our plug-and-play SDK. Our API-first approach lets businesses go live in under 10 minutes.',
  ARRAY['payments', 'fintech', 'api', 'sdk', 'sme'],
  ARRAY['FinTech', 'Payments', 'SaaS'],
  'https://payflow.example.com', '2023-06-01',
  'Bangalore', 'Karnataka', 'India', 'hello@payflow.in', 'B2B', '11-50',
  'We make digital payments dead simple for small businesses in emerging markets. Zero code, ten minutes to go live.',
  'API-first architecture, 99.99% uptime, sub-200ms latency. Already processing 2M+ transactions/month.',
  'SMBs, D2C brands, kirana stores transitioning to digital payments.',
  '4,50,000', 'INR', '22%', '2.1M transactions/month, 12K active merchants, 98% retention, NPS 72',
  '$2.4M', 8, true, '$5M', '12%',
  '$50K', 'series_a', 'FinTech',
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s1_id;

-- 2. HealthTech startup (MVP, B2C)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, registered_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'MedBridge', 'MedBridge Health Solutions LLP', 'llp', 'mvp',
  'MedBridge connects rural patients with specialist doctors through an AI-powered triage system and telemedicine platform. Our app works on 2G networks and supports 12 Indian languages.',
  ARRAY['healthtech', 'telemedicine', 'ai', 'rural-health', 'accessibility'],
  ARRAY['HealthTech', 'AI/ML', 'Social Impact'],
  'https://medbridge.health', '2024-01-15',
  'Hyderabad', 'Telangana', 'India', 'team@medbridge.health', 'B2C', '6-10',
  'AI-powered healthcare access for Bharat. Works on 2G, speaks 12 languages.',
  'Ultra-lightweight app (3MB), works offline, AI triage accuracy 89%. Founded by AIIMS alumni.',
  'Rural and semi-urban patients, PHC doctors, ASHA workers.',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s2_id;

-- 3. EdTech startup (Expansion, B2B2C)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  revenue_amount, revenue_currency, revenue_growth, traction_metrics,
  total_raised, investor_count, is_actively_raising,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'SkillForge', 'not_registered', 'expansion',
  'SkillForge is a project-based learning platform where students build real products for real companies. Companies post micro-projects, students solve them, and the best get hired. Think GitHub meets Upwork for campus talent.',
  ARRAY['edtech', 'hiring', 'project-based-learning', 'campus'],
  ARRAY['EdTech', 'HR Tech', 'Marketplace'],
  'https://skillforge.io', '2022-09-01',
  'Delhi', 'Delhi', 'India', 'founders@skillforge.io', 'B2B2C', '11-50',
  'Students learn by building real products for real companies. Best performers get hired on the spot.',
  '180+ partner companies including Razorpay, Zerodha. 45K student community. 78% hire-through rate.',
  'Tier 1-3 college students, engineering managers looking for junior talent.',
  '12,00,000', 'INR', '18%', '45K students, 180 companies, 2.1K hires made, 4.8 avg rating',
  '$1.8M', 5, false,
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s3_id;

-- 4. CleanTech startup (Ideation, B2B)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, legal_status, stage,
  description, keywords, categories, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'CarbonZero', 'not_registered', 'ideation',
  'CarbonZero is building an automated carbon accounting platform for Indian manufacturers. We integrate with existing ERP systems to track Scope 1-3 emissions in real-time, generate BRSR-compliant reports, and suggest reduction pathways.',
  ARRAY['cleantech', 'carbon-accounting', 'sustainability', 'compliance', 'manufacturing'],
  ARRAY['CleanTech', 'Enterprise SaaS', 'Sustainability'],
  '2025-01-01',
  'Pune', 'Maharashtra', 'India', 'info@carbonzero.in', 'B2B', '1-5',
  'Automated carbon accounting for Indian manufacturers. BRSR-ready reports in minutes, not months.',
  'Deep domain expertise in Indian manufacturing compliance. Founding team from Tata Steel and BCG.',
  'Mid-to-large Indian manufacturers preparing for SEBI BRSR mandates.',
  'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s4_id;

-- 5. D2C / Consumer startup (Scaling, B2C)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, registered_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  revenue_amount, revenue_currency, revenue_growth, traction_metrics,
  total_raised, investor_count, is_actively_raising, raise_target,
  funding_stage, sector,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'NutriBox', 'NutriBox Foods Pvt. Ltd.', 'pvt_ltd', 'scaling',
  'NutriBox delivers personalized, dietitian-designed meal plans to your door. Our AI nutrition engine creates plans based on your health goals, allergies, and taste preferences. Fresh, calorie-counted, macro-balanced meals — no cooking required.',
  ARRAY['d2c', 'food', 'nutrition', 'health', 'subscription'],
  ARRAY['Food & Beverage', 'Health & Wellness', 'D2C'],
  'https://nutribox.co', '2023-03-01',
  'Mumbai', 'Maharashtra', 'India', 'hello@nutribox.co', 'B2C', '11-50',
  'AI-powered meal plans delivered fresh daily. Personalized nutrition without the cooking.',
  '92% week-4 retention, avg order value 450 INR, 3 cloud kitchens in Mumbai.',
  'Health-conscious urban professionals aged 25-40, fitness enthusiasts, people with dietary restrictions.',
  '28,00,000', 'INR', '30%', '8.5K active subscribers, 92% W4 retention, 450 INR AOV, NPS 68',
  '$800K', 3, true, '$3M',
  'seed', 'Food & Nutrition',
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s5_id;

-- Add founders for each startup
INSERT INTO startup_founders (startup_id, name, role, display_order, status) VALUES
  (_s1_id, 'Arjun Mehta', 'CEO & Co-founder', 0, 'accepted'),
  (_s1_id, 'Priya Sharma', 'CTO & Co-founder', 1, 'accepted'),
  (_s2_id, 'Dr. Kavya Reddy', 'CEO & Founder', 0, 'accepted'),
  (_s2_id, 'Rohan Iyer', 'CTO', 1, 'accepted'),
  (_s3_id, 'Neha Gupta', 'CEO', 0, 'accepted'),
  (_s3_id, 'Aditya Verma', 'CPO', 1, 'accepted'),
  (_s4_id, 'Vikram Deshmukh', 'Founder', 0, 'accepted'),
  (_s5_id, 'Ananya Joshi', 'CEO & Co-founder', 0, 'accepted'),
  (_s5_id, 'Karan Patel', 'Head of Operations', 1, 'accepted');

-- Add funding rounds for PayFlow
INSERT INTO startup_funding_rounds (startup_id, round_type, amount, investor, round_date, is_public) VALUES
  (_s1_id, 'pre_seed', '$200K', 'Angel investors', '2023-08-01', true),
  (_s1_id, 'seed', '$2.2M', 'Sequoia Surge, Blume Ventures', '2024-03-01', true);

-- Add funding rounds for NutriBox
INSERT INTO startup_funding_rounds (startup_id, round_type, amount, investor, round_date, is_public) VALUES
  (_s5_id, 'pre_seed', '$150K', 'Friends & Family', '2023-06-01', true),
  (_s5_id, 'seed', '$650K', 'Titan Capital, 2AM VC', '2024-01-01', true);

-- Add some text sections (showcase content)
INSERT INTO startup_text_sections (startup_id, heading, content, display_order) VALUES
  (_s1_id, 'The Problem', 'India has 63M+ SMBs, but less than 15% accept digital payments. The existing solutions require technical integration, charge high MDR, and have terrible merchant support. We''re fixing this.', 0),
  (_s1_id, 'Our Solution', 'A plug-and-play SDK that takes 10 minutes to integrate. QR, UPI, cards, wallets — everything in one dashboard. Zero MDR on UPI. WhatsApp-first merchant support.', 1),
  (_s2_id, 'Why This Matters', '70% of India lives in rural areas with limited access to specialist healthcare. Patients travel 50+ km for a consultation that could happen over video. Our AI triage ensures the right patients reach the right doctors.', 0),
  (_s3_id, 'How It Works', '1. Companies post micro-projects (2-4 week sprints). 2. Students apply and get matched. 3. They build, ship, and get reviewed. 4. Top performers receive job offers. Companies pay only for results.', 0);

RAISE NOTICE 'Seeded 5 demo startups: PayFlow (%), MedBridge (%), SkillForge (%), CarbonZero (%), NutriBox (%)',
  _s1_id, _s2_id, _s3_id, _s4_id, _s5_id;

END $$;
