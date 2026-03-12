-- Seed Demo Startups — Batch 2 (10 more)
-- Run this in the Supabase SQL Editor.
-- Replace YOUR_USER_ID with your actual user UUID from auth.users.

DO $$
DECLARE
  _owner_id UUID := 'YOUR_USER_ID';  -- <-- REPLACE THIS
  _s6_id UUID;
  _s7_id UUID;
  _s8_id UUID;
  _s9_id UUID;
  _s10_id UUID;
  _s11_id UUID;
  _s12_id UUID;
  _s13_id UUID;
  _s14_id UUID;
  _s15_id UUID;
BEGIN

-- 6. AgriTech startup (MVP, B2B)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, registered_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  traction_metrics,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'KisanLink', 'KisanLink Agritech Pvt. Ltd.', 'pvt_ltd', 'mvp',
  'KisanLink eliminates middlemen in agricultural supply chains by connecting farmers directly with retailers and restaurants. Our platform uses satellite imagery and weather data to predict crop yields and optimize pricing in real-time.',
  ARRAY['agritech', 'supply-chain', 'farmers', 'satellite', 'pricing'],
  ARRAY['AgriTech', 'Marketplace', 'AI/ML'],
  'https://kisanlink.in', '2024-03-01',
  'Indore', 'Madhya Pradesh', 'India', 'hello@kisanlink.in', 'B2B', '6-10',
  'Farm-to-fork without the middlemen. Satellite-powered yield prediction meets real-time pricing.',
  'Direct partnerships with 800+ farmers across MP. Satellite yield predictions within 12% accuracy. 30% better prices for farmers.',
  'Small-to-mid farmers, restaurant chains, organic grocery retailers.',
  '800 farmers onboarded, 45 restaurant partners, 3.2K tonnes moved, 30% avg price improvement for farmers',
  'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s6_id;

-- 7. LegalTech startup (Scaling, B2B, raising)
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
  _owner_id, 'startup', 'LegalPilot', 'LegalPilot Solutions Pvt. Ltd.', 'pvt_ltd', 'scaling',
  'LegalPilot automates contract review, compliance tracking, and legal workflow for Indian startups and SMBs. Our AI reads contracts in English and Hindi, flags risky clauses, and generates compliant templates in minutes.',
  ARRAY['legaltech', 'ai', 'contracts', 'compliance', 'automation'],
  ARRAY['LegalTech', 'AI/ML', 'Enterprise SaaS'],
  'https://legalpilot.in', '2023-01-15',
  'Bangalore', 'Karnataka', 'India', 'team@legalpilot.in', 'B2B', '11-50',
  'AI-powered legal ops for Indian startups. Contract review in minutes, not days.',
  'Processes 500+ contracts/day, supports English and Hindi. 94% clause detection accuracy. SOC 2 compliant.',
  'Startup founders, in-house legal teams at SMBs, CA/CS firms.',
  '18,00,000', 'INR', '25%', '320 companies, 12K contracts reviewed, 94% accuracy, 4.7 rating',
  '$1.5M', 6, true, '$4M',
  'series_a', 'LegalTech',
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s7_id;

-- 8. SpaceTech / DeepTech startup (Ideation, B2G)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, legal_status, stage,
  description, keywords, categories, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'OrbitView', 'not_registered', 'ideation',
  'OrbitView is developing low-cost micro-satellite constellations for real-time earth observation. Our proprietary on-board AI processes imagery in orbit, delivering actionable insights to defence, agriculture, and disaster management agencies within minutes.',
  ARRAY['spacetech', 'satellite', 'earth-observation', 'defence', 'deeptech'],
  ARRAY['SpaceTech', 'DeepTech', 'Defence'],
  '2025-02-01',
  'Thiruvananthapuram', 'Kerala', 'India', 'founders@orbitview.space', 'B2G', '1-5',
  'Real-time earth observation with on-board AI. Minutes, not hours.',
  'Founding team from ISRO and DRDO. Patent-pending on-board image processing chip. Selected for IN-SPACe accelerator.',
  'ISRO, Indian defence agencies, state disaster management authorities, large agri-corporates.',
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s8_id;

-- 9. PropTech startup (Expansion, B2C)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, registered_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  revenue_amount, revenue_currency, revenue_growth, traction_metrics,
  total_raised, investor_count, is_actively_raising,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'NestEasy', 'NestEasy Realty Technologies Pvt. Ltd.', 'pvt_ltd', 'expansion',
  'NestEasy makes renting a home in Indian cities painless. Zero brokerage, verified listings with 3D walkthroughs, digital agreements, and an in-app maintenance request system. We''re Opendoor meets NoBroker, but built for Gen Z renters.',
  ARRAY['proptech', 'rental', 'real-estate', '3d-tours', 'zero-brokerage'],
  ARRAY['PropTech', 'Marketplace', 'Consumer'],
  'https://nesteasy.co', '2022-11-01',
  'Bangalore', 'Karnataka', 'India', 'hello@nesteasy.co', 'B2C', '51-100',
  'Zero-brokerage rentals with 3D walkthroughs. Moving in shouldn''t be stressful.',
  '15K+ verified listings across 3 cities. Average time-to-move-in: 4 days. NPS 74.',
  'Gen Z and millennial renters (22-35), working professionals relocating to metros.',
  '45,00,000', 'INR', '35%', '15K listings, 8K tenants placed, 3 cities live, 4-day avg move-in, NPS 74',
  '$3.2M', 10, false,
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s9_id;

-- 10. Gaming / Entertainment startup (MVP, B2C)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'PlayCraft Studios', 'llp', 'mvp',
  'PlayCraft Studios builds hyper-casual mobile games rooted in Indian mythology and folklore. Our first title "Ramayana Run" hit 500K downloads in 8 weeks. We monetize through in-app purchases and brand partnerships with FMCG companies.',
  ARRAY['gaming', 'mobile', 'mythology', 'entertainment', 'casual-games'],
  ARRAY['Gaming', 'Entertainment', 'Consumer'],
  'https://playcraft.games', '2024-06-01',
  'Pune', 'Maharashtra', 'India', 'studio@playcraft.games', 'B2C', '6-10',
  'Indian mythology meets hyper-casual gaming. 500K downloads and counting.',
  'First title 500K downloads in 8 weeks organically. D1 retention 45%, D7 28%. Ex-Zynga and Moonfrog founding team.',
  'Mobile gamers aged 16-30, casual gaming audience in India and SE Asia.',
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s10_id;

-- 11. Logistics / Supply Chain startup (Scaling, B2B, raising)
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
  _owner_id, 'startup', 'FreightBridge', 'FreightBridge Logistics Pvt. Ltd.', 'pvt_ltd', 'scaling',
  'FreightBridge is a full-stack logistics platform that optimizes last-mile delivery for D2C brands. Our AI route engine reduces delivery costs by 22% and cuts delivery times by 35% compared to traditional 3PLs. Real-time tracking, automated NDR management, and smart warehouse allocation.',
  ARRAY['logistics', 'last-mile', 'delivery', 'ai', 'd2c'],
  ARRAY['Logistics', 'AI/ML', 'Enterprise SaaS'],
  'https://freightbridge.in', '2022-06-01',
  'Gurgaon', 'Haryana', 'India', 'ops@freightbridge.in', 'B2B', '51-100',
  'AI-powered last-mile delivery that''s 22% cheaper and 35% faster than traditional 3PLs.',
  '200+ D2C brand clients, 15 warehouse hubs, 22% cost reduction, 35% faster delivery. Processing 80K shipments/day.',
  'D2C brands doing 500+ orders/day, e-commerce companies, quick-commerce players.',
  '1,20,00,000', 'INR', '40%', '200 brands, 80K shipments/day, 15 hubs, 22% cost savings, 98.5% delivery rate',
  '$6M', 12, true, '$15M',
  'series_b', 'Logistics',
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1494412574643-ff11b0a5eb19?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s11_id;

-- 12. Mental Health / Wellness startup (MVP, B2C)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, registered_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'MindSpark', 'MindSpark Wellness LLP', 'llp', 'mvp',
  'MindSpark is an AI therapy companion that provides CBT-based mental health support in Indian languages. It bridges the gap between expensive therapy sessions with affordable, always-available support. All conversations are clinically validated and supervised by licensed therapists.',
  ARRAY['mentalhealth', 'wellness', 'ai', 'therapy', 'cbt'],
  ARRAY['HealthTech', 'AI/ML', 'Social Impact'],
  'https://mindspark.care', '2024-08-01',
  'Chennai', 'Tamil Nadu', 'India', 'care@mindspark.care', 'B2C', '6-10',
  'AI therapy companion that speaks your language. Clinically validated, always available, actually affordable.',
  'Supports 8 Indian languages. Clinically validated CBT protocols. Licensed therapist oversight. 200 INR/month.',
  'Young professionals (22-35) dealing with anxiety and stress, college students, tier 2-3 city residents with limited therapist access.',
  'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s12_id;

-- 13. DevTools / SaaS startup (Expansion, B2B)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, registered_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  revenue_amount, revenue_currency, revenue_growth, traction_metrics,
  total_raised, investor_count, is_actively_raising,
  funding_stage, sector,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'ShipFast', 'ShipFast Developer Tools Pvt. Ltd.', 'pvt_ltd', 'expansion',
  'ShipFast is a developer platform that turns any backend API into a production-ready mobile app in hours. Auto-generates React Native screens from your OpenAPI spec, handles auth, push notifications, and offline sync out of the box. Ship your MVP before the hackathon ends.',
  ARRAY['devtools', 'saas', 'mobile', 'api', 'react-native', 'low-code'],
  ARRAY['DevTools', 'SaaS', 'Developer Platform'],
  'https://shipfast.dev', '2023-04-01',
  'Bangalore', 'Karnataka', 'India', 'dev@shipfast.dev', 'B2B', '11-50',
  'Turn your API into a production mobile app in hours, not months. Auto-generated, fully customizable.',
  'Used by 2,800+ developers globally. 40+ app templates. SOC 2 Type II. YC W24 batch.',
  'Startup CTOs, indie developers, enterprise mobile teams, hackathon participants.',
  '35,00,000', 'INR', '28%', '2.8K developers, 600 apps shipped, 40 templates, 4.9 rating on Product Hunt',
  '$4.5M', 8, false,
  'series_a', 'DevTools',
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s13_id;

-- 14. EV / Mobility startup (Scaling, B2C, raising)
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
  _owner_id, 'startup', 'VoltRide', 'VoltRide Mobility Pvt. Ltd.', 'pvt_ltd', 'scaling',
  'VoltRide operates a network of battery-swapping stations for electric two-wheelers. Riders swap a drained battery for a full one in 90 seconds — no charging wait. Our IoT-enabled smart batteries track health, optimize charging cycles, and predict maintenance.',
  ARRAY['ev', 'mobility', 'battery-swap', 'iot', 'cleantech'],
  ARRAY['CleanTech', 'Mobility', 'IoT'],
  'https://voltride.in', '2022-08-01',
  'Chennai', 'Tamil Nadu', 'India', 'ride@voltride.in', 'B2C', '51-100',
  '90-second battery swaps for electric two-wheelers. No waiting, no range anxiety.',
  '120 swap stations across Chennai and Bangalore. 8K active riders. 50K+ swaps/month. Battery health prediction 96% accurate.',
  'Delivery riders (Swiggy, Zomato, Dunzo), daily commuters on electric scooters.',
  '85,00,000', 'INR', '45%', '120 stations, 8K riders, 50K swaps/month, 90-sec avg swap time, 96% battery prediction accuracy',
  '$8M', 14, true, '$20M',
  'series_b', 'Mobility',
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s14_id;

-- 15. Creator Economy / Social startup (MVP, B2C)
INSERT INTO startup_profiles (
  owner_id, entity_type, brand_name, legal_status, stage,
  description, keywords, categories, website, founded_date,
  city, state, country, startup_email, business_model, team_size,
  elevator_pitch, key_strengths, target_audience,
  traction_metrics,
  logo_url, banner_url,
  visibility, is_published, is_featured
) VALUES (
  _owner_id, 'startup', 'FanVerse', 'not_registered', 'mvp',
  'FanVerse lets creators in India monetize their superfans through exclusive content, live rooms, and digital collectibles. Think Patreon meets Discord, designed for Bharat — UPI-first payments, WhatsApp sharing, regional language support.',
  ARRAY['creator-economy', 'social', 'monetization', 'content', 'community'],
  ARRAY['Creator Economy', 'Social', 'Consumer'],
  'https://fanverse.club', '2024-10-01',
  'Mumbai', 'Maharashtra', 'India', 'creators@fanverse.club', 'B2C', '1-5',
  'Where Indian creators turn superfans into a sustainable income. UPI-first, WhatsApp-native.',
  'Beta with 120 creators across YouTube, Instagram, and podcasting. 18K paying fans. Avg creator earns 45K INR/month.',
  'Indian content creators (10K-500K followers), superfans willing to pay for exclusive access.',
  '120 creators, 18K paying fans, 45K INR avg creator earnings/month, 85% M1 creator retention',
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?w=1200&h=400&fit=crop',
  'public', true, true
) RETURNING id INTO _s15_id;

-- Add founders for batch 2
INSERT INTO startup_founders (startup_id, name, role, display_order, status) VALUES
  (_s6_id, 'Rajesh Tiwari', 'CEO & Co-founder', 0, 'accepted'),
  (_s6_id, 'Sunita Yadav', 'COO & Co-founder', 1, 'accepted'),
  (_s7_id, 'Meera Krishnan', 'CEO & Founder', 0, 'accepted'),
  (_s7_id, 'Siddharth Nair', 'CTO', 1, 'accepted'),
  (_s8_id, 'Dr. Ajay Menon', 'Founder & CEO', 0, 'accepted'),
  (_s8_id, 'Lakshmi Pillai', 'Co-founder & CTO', 1, 'accepted'),
  (_s9_id, 'Rahul Saxena', 'CEO & Co-founder', 0, 'accepted'),
  (_s9_id, 'Divya Agarwal', 'CPO', 1, 'accepted'),
  (_s9_id, 'Manish Tomar', 'CTO', 2, 'accepted'),
  (_s10_id, 'Aryan Kulkarni', 'CEO & Game Designer', 0, 'accepted'),
  (_s10_id, 'Sneha Bhosale', 'Art Director', 1, 'accepted'),
  (_s11_id, 'Amit Choudhary', 'CEO & Co-founder', 0, 'accepted'),
  (_s11_id, 'Ritu Singh', 'CTO & Co-founder', 1, 'accepted'),
  (_s11_id, 'Danish Khan', 'VP Operations', 2, 'accepted'),
  (_s12_id, 'Dr. Preethi Rajan', 'CEO & Founder', 0, 'accepted'),
  (_s12_id, 'Arvind Subramanian', 'CTO', 1, 'accepted'),
  (_s13_id, 'Kunal Bhat', 'CEO & Co-founder', 0, 'accepted'),
  (_s13_id, 'Tanvi Desai', 'CTO & Co-founder', 1, 'accepted'),
  (_s14_id, 'Vijay Raghavan', 'CEO & Co-founder', 0, 'accepted'),
  (_s14_id, 'Deepa Suresh', 'CTO & Co-founder', 1, 'accepted'),
  (_s14_id, 'Manoj Pillai', 'VP Hardware', 2, 'accepted'),
  (_s15_id, 'Isha Malhotra', 'CEO & Founder', 0, 'accepted');

-- Add funding rounds
INSERT INTO startup_funding_rounds (startup_id, round_type, amount, investor, round_date, is_public) VALUES
  (_s7_id, 'pre_seed', '$300K', 'Rainmatter, angel investors', '2023-04-01', true),
  (_s7_id, 'seed', '$1.2M', 'Accel India, LegalTech Fund', '2024-01-01', true),
  (_s9_id, 'seed', '$1.5M', '100X.VC, Housing.com founders', '2023-03-01', true),
  (_s9_id, 'series_a', '$3.2M', 'Tiger Global, Nexus Venture Partners', '2024-06-01', true),
  (_s11_id, 'seed', '$1M', 'Venture Highway', '2022-12-01', true),
  (_s11_id, 'series_a', '$5M', 'Lightspeed India, Stellaris', '2023-10-01', true),
  (_s13_id, 'pre_seed', '$500K', 'Y Combinator', '2023-06-01', true),
  (_s13_id, 'seed', '$2M', 'a16z Scout, Initialized Capital', '2024-02-01', true),
  (_s13_id, 'series_a', '$4.5M', 'Bessemer Venture Partners', '2025-01-01', true),
  (_s14_id, 'seed', '$2M', 'Climate Angels, Ola founders', '2023-01-01', true),
  (_s14_id, 'series_a', '$6M', 'Sequoia India, BP Ventures', '2024-04-01', true);

-- Add text sections for batch 2
INSERT INTO startup_text_sections (startup_id, heading, content, display_order) VALUES
  (_s6_id, 'The Problem', 'Indian farmers lose 25-40% of their income to middlemen. They have zero visibility into real-time market prices and no way to connect directly with end buyers. We''re building the rails for a fairer food supply chain.', 0),
  (_s6_id, 'How It Works', 'Farmers list their harvest on our app with a photo. Our AI grades the produce, predicts yield from satellite data, and matches them with the best-paying buyer within 50km. Payment is instant via UPI.', 1),
  (_s8_id, 'The Vision', 'India''s space economy is projected to hit $13B by 2025. We believe the next frontier isn''t just launching satellites — it''s making the data they capture actionable in real-time. Our on-board AI processes imagery before it even reaches the ground.', 0),
  (_s10_id, 'Why Indian Mythology?', 'India has 500M+ mobile gamers, but most play Western-themed games. We''re tapping into cultural pride with stories every Indian grew up with — Ramayana, Mahabharata, Panchatantra — reimagined as addictive hyper-casual games.', 0),
  (_s12_id, 'The Gap', 'India has 1 psychiatrist per 100,000 people. Therapy costs 2,000-5,000 INR/session. 80% of people who need mental health support never get it. MindSpark makes clinically validated CBT support accessible at 200 INR/month in 8 languages.', 0),
  (_s14_id, 'Why Battery Swapping?', 'Charging an EV takes 4-6 hours. Delivery riders can''t afford that downtime. Our swap stations let them exchange batteries in 90 seconds. The rider never owns the battery — we manage the asset, they pay per swap. Think gas station economics for EVs.', 0),
  (_s15_id, 'The Creator Problem', 'Indian creators with 100K followers earn less than 15K INR/month from ads. Platforms take 30-45% cuts. We let creators keep 90% of what fans pay, with UPI for instant payouts and WhatsApp for frictionless sharing.', 0);

RAISE NOTICE 'Seeded 10 more demo startups: KisanLink (%), LegalPilot (%), OrbitView (%), NestEasy (%), PlayCraft (%), FreightBridge (%), MindSpark (%), ShipFast (%), VoltRide (%), FanVerse (%)',
  _s6_id, _s7_id, _s8_id, _s9_id, _s10_id, _s11_id, _s12_id, _s13_id, _s14_id, _s15_id;

END $$;
