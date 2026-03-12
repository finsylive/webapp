import { supabase } from '@/utils/supabase';
import { PostgrestError } from '@supabase/supabase-js';

// --- Types ---

export type EntityType = 'org_project' | 'startup';

export type StartupProfile = {
  id: string;
  owner_id: string;
  brand_name: string;
  registered_name: string | null;
  legal_status: 'llp' | 'pvt_ltd' | 'sole_proprietorship' | 'not_registered';
  cin: string | null;
  stage: 'ideation' | 'mvp' | 'scaling' | 'expansion' | 'maturity';
  description: string | null;
  keywords: string[];
  website: string | null;
  founded_date: string | null;
  address_line1: string | null;
  address_line2: string | null;
  state: string | null;
  startup_email: string | null;
  startup_phone: string | null;
  pitch_deck_url: string | null;
  is_actively_raising: boolean;
  visibility: 'public' | 'investors_only' | 'private';
  is_published: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  // Entity type (org_project or startup)
  entity_type: EntityType;
  // Onboarding fields
  business_model: string | null;
  city: string | null;
  country: string | null;
  categories: string[];
  team_size: string | null;
  key_strengths: string | null;
  target_audience: string | null;
  revenue_amount: string | null;
  revenue_currency: string | null;
  revenue_growth: string | null;
  traction_metrics: string | null;
  total_raised: string | null;
  investor_count: number | null;
  elevator_pitch: string | null;
  logo_url: string | null;
  banner_url: string | null;
  pitch_video_url: string | null;
  // Fundraising fields
  raise_target: string | null;
  equity_offered: string | null;
  min_ticket_size: string | null;
  funding_stage: 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c' | 'bridge' | null;
  sector: string | null;
  // Relations
  founders?: StartupFounder[];
  funding_rounds?: StartupFundingRound[];
  incubators?: StartupIncubator[];
  awards?: StartupAward[];
  slides?: StartupSlide[];
  links?: StartupLink[];
  text_sections?: StartupTextSection[];
  is_bookmarked?: boolean;
  view_count?: number;
};

export type StartupFounder = {
  id: string;
  startup_id: string;
  name: string;
  role: string | null;
  linkedin_url: string | null;
  email: string | null;
  user_id: string | null;
  ments_username: string | null;
  avatar_url: string | null;
  status: 'pending' | 'accepted' | 'declined';
  display_order: number;
  created_at: string;
  user?: {
    username: string;
    avatar_url: string | null;
  };
};

export type StartupFundingRound = {
  id: string;
  startup_id: string;
  investor: string | null;
  amount: string | null;
  round_type: 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c' | 'other' | null;
  round_date: string | null;
  is_public: boolean;
  created_at: string;
};

export type StartupIncubator = {
  id: string;
  startup_id: string;
  program_name: string;
  year: number | null;
  created_at: string;
};

export type StartupAward = {
  id: string;
  startup_id: string;
  award_name: string;
  year: number | null;
  created_at: string;
};

export type StartupSlide = {
  id: string;
  startup_id: string;
  slide_url: string;
  caption: string | null;
  slide_number: number;
  created_at: string;
};

export type StartupLink = {
  id: string;
  startup_id: string;
  title: string;
  url: string;
  icon_name: string | null;
  display_order: number;
  created_at: string;
};

export type StartupTextSection = {
  id: string;
  startup_id: string;
  heading: string;
  content: string;
  display_order: number;
  created_at: string;
};

export type StartupsResponse = {
  data: StartupProfile[] | null;
  error: PostgrestError | null;
  hasMore?: boolean;
};

export type StartupResponse = {
  data: StartupProfile | null;
  error: PostgrestError | null;
};

// --- Fetch functions ---

export async function fetchStartups(opts: {
  limit?: number;
  offset?: number;
  stage?: string;
  raising?: boolean;
  keyword?: string;
  search?: string;
  entity_type?: EntityType;
} = {}): Promise<StartupsResponse> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  try {
    let query = supabase
      .from('startup_profiles')
      .select(`
        *,
        founders:startup_founders(*, user:users(username, avatar_url)),
        funding_rounds:startup_funding_rounds(*),
        incubators:startup_incubators(*),
        awards:startup_awards(*)
      `, { count: 'exact' })
      .eq('is_published', true);

    if (opts.entity_type) {
      query = query.eq('entity_type', opts.entity_type);
    }
    if (opts.stage) {
      query = query.eq('stage', opts.stage);
    }
    if (opts.raising !== undefined) {
      query = query.eq('is_actively_raising', opts.raising);
    }
    if (opts.keyword) {
      query = query.contains('keywords', [opts.keyword]);
    }
    if (opts.search) {
      // Search across brand name, description, elevator pitch, and key strengths
      query = query.or(`brand_name.ilike.%${opts.search}%,description.ilike.%${opts.search}%,elevator_pitch.ilike.%${opts.search}%,key_strengths.ilike.%${opts.search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: null, error };
    }

    const total = count ?? (data?.length || 0);
    const hasMore = offset + (data?.length || 0) < total;

    return { data: data as StartupProfile[], error: null, hasMore };
  } catch (err) {
    console.error('Error in fetchStartups:', err);
    return { data: null, error: err as PostgrestError };
  }
}

export async function fetchStartupById(id: string, userId?: string): Promise<StartupResponse> {
  try {
    const { data, error } = await supabase
      .from('startup_profiles')
      .select(`
        *,
        founders:startup_founders(*, user:users(username, avatar_url)),
        funding_rounds:startup_funding_rounds(*),
        incubators:startup_incubators(*),
        awards:startup_awards(*),
        slides:startup_slides(*),
        links:startup_links(*),
        text_sections:startup_text_sections(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error };
    }

    const startup = data as StartupProfile;

    // Check if bookmarked by current user
    if (userId) {
      const { data: bookmark } = await supabase
        .from('startup_bookmarks')
        .select('id')
        .eq('startup_id', id)
        .eq('user_id', userId)
        .maybeSingle();

      startup.is_bookmarked = !!bookmark;
    }

    // Get view count
    const { count } = await supabase
      .from('startup_profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', id);

    startup.view_count = count || 0;

    return { data: startup, error: null };
  } catch (err) {
    console.error('Error in fetchStartupById:', err);
    return { data: null, error: err as PostgrestError };
  }
}

export async function fetchMyStartup(ownerId: string): Promise<StartupResponse> {
  try {
    const { data, error } = await supabase
      .from('startup_profiles')
      .select(`
        *,
        founders:startup_founders(*, user:users(username, avatar_url)),
        funding_rounds:startup_funding_rounds(*),
        incubators:startup_incubators(*),
        awards:startup_awards(*)
      `)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    if (data) {
      const { count } = await supabase
        .from('startup_profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('startup_id', data.id);

      (data as StartupProfile).view_count = count || 0;
    }

    return { data: data as StartupProfile | null, error: null };
  } catch (err) {
    console.error('Error in fetchMyStartup:', err);
    return { data: null, error: err as PostgrestError };
  }
}

export async function fetchMyVentures(ownerId: string): Promise<StartupsResponse> {
  try {
    const { data, error } = await supabase
      .from('startup_profiles')
      .select(`
        *,
        founders:startup_founders(*, user:users(username, avatar_url)),
        funding_rounds:startup_funding_rounds(*),
        incubators:startup_incubators(*),
        awards:startup_awards(*)
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    // Enrich with view counts
    if (data && data.length > 0) {
      await Promise.all(
        data.map(async (item: Record<string, unknown>) => {
          const { count } = await supabase
            .from('startup_profile_views')
            .select('*', { count: 'exact', head: true })
            .eq('startup_id', item.id);
          (item as StartupProfile).view_count = count || 0;
        })
      );
    }

    return { data: data as StartupProfile[], error: null };
  } catch (err) {
    console.error('Error in fetchMyVentures:', err);
    return { data: null, error: err as PostgrestError };
  }
}

// --- Mutations ---

export async function createStartup(
  profile: Omit<StartupProfile, 'id' | 'created_at' | 'updated_at' | 'founders' | 'funding_rounds' | 'incubators' | 'awards' | 'slides' | 'links' | 'text_sections' | 'is_bookmarked' | 'view_count'>
): Promise<StartupResponse> {
  const { data, error } = await supabase
    .from('startup_profiles')
    .insert([profile])
    .select()
    .single();

  return { data: data as StartupProfile | null, error };
}

export async function updateStartup(
  id: string,
  updates: Partial<Omit<StartupProfile, 'id' | 'owner_id' | 'created_at' | 'founders' | 'funding_rounds' | 'incubators' | 'awards' | 'slides' | 'links' | 'text_sections' | 'is_bookmarked' | 'view_count'>>
): Promise<StartupResponse> {
  const { data, error } = await supabase
    .from('startup_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  return { data: data as StartupProfile | null, error };
}

export async function deleteStartup(id: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('startup_profiles')
    .delete()
    .eq('id', id);

  return { error };
}

// --- Founders ---

export async function upsertFounders(
  startupId: string,
  founders: { name: string; linkedin_url?: string; user_id?: string; ments_username?: string; display_order: number }[]
): Promise<{ error: PostgrestError | null }> {
  // Get existing founders to preserve accepted statuses
  const { data: existing } = await supabase
    .from('startup_founders')
    .select('user_id, status')
    .eq('startup_id', startupId);

  const acceptedUserIds = new Set(
    (existing || []).filter((f: { user_id: string | null; status: string }) => f.user_id && f.status === 'accepted').map((f: { user_id: string | null }) => f.user_id)
  );

  // Delete existing founders and re-insert
  const { error: deleteError } = await supabase
    .from('startup_founders')
    .delete()
    .eq('startup_id', startupId);

  if (deleteError) return { error: deleteError };

  if (founders.length === 0) return { error: null };

  // Set status: if user_id is linked, check if they were already accepted
  const rows = founders.map(f => ({
    ...f,
    startup_id: startupId,
    status: f.user_id
      ? acceptedUserIds.has(f.user_id) ? 'accepted' : 'pending'
      : 'accepted', // name-only founders are auto-accepted
  }));

  const { error } = await supabase
    .from('startup_founders')
    .insert(rows);

  return { error };
}

// --- Funding Rounds ---

export async function upsertFundingRounds(
  startupId: string,
  rounds: { investor?: string; amount?: string; round_type?: string; round_date?: string; is_public?: boolean }[]
): Promise<{ error: PostgrestError | null }> {
  const { error: deleteError } = await supabase
    .from('startup_funding_rounds')
    .delete()
    .eq('startup_id', startupId);

  if (deleteError) return { error: deleteError };

  if (rounds.length === 0) return { error: null };

  const { error } = await supabase
    .from('startup_funding_rounds')
    .insert(rounds.map(r => ({ ...r, startup_id: startupId })));

  return { error };
}

// --- Incubators ---

export async function upsertIncubators(
  startupId: string,
  incubators: { program_name: string; year?: number }[]
): Promise<{ error: PostgrestError | null }> {
  const { error: deleteError } = await supabase
    .from('startup_incubators')
    .delete()
    .eq('startup_id', startupId);

  if (deleteError) return { error: deleteError };

  if (incubators.length === 0) return { error: null };

  const { error } = await supabase
    .from('startup_incubators')
    .insert(incubators.map(i => ({
      ...i,
      startup_id: startupId,
      year: i.year ? `${i.year}-01-01` : null,
    })));

  return { error };
}

// --- Awards ---

export async function upsertAwards(
  startupId: string,
  awards: { award_name: string; year?: number }[]
): Promise<{ error: PostgrestError | null }> {
  const { error: deleteError } = await supabase
    .from('startup_awards')
    .delete()
    .eq('startup_id', startupId);

  if (deleteError) return { error: deleteError };

  if (awards.length === 0) return { error: null };

  const { error } = await supabase
    .from('startup_awards')
    .insert(awards.map(a => ({
      ...a,
      startup_id: startupId,
      year: a.year ? `${a.year}-01-01` : null,
    })));

  return { error };
}

// --- Bookmarks ---

export async function bookmarkStartup(userId: string, startupId: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('startup_bookmarks')
    .insert([{ user_id: userId, startup_id: startupId }]);

  return { error };
}

export async function unbookmarkStartup(userId: string, startupId: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('startup_bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('startup_id', startupId);

  return { error };
}

// --- Views ---

export async function recordView(startupId: string, viewerId?: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('startup_profile_views')
    .insert([{ startup_id: startupId, viewer_id: viewerId || null }]);

  return { error };
}

// --- Showcase Limits ---

export const SHOWCASE_LIMITS = {
  sections: 20,
  links: 30,
  slides: 50,
} as const;

// --- Slides ---

export async function upsertSlides(
  startupId: string,
  slides: { slide_url: string; caption?: string; slide_number: number }[]
): Promise<{ error: PostgrestError | null }> {
  if (slides.length > SHOWCASE_LIMITS.slides) {
    return { error: { message: `Maximum ${SHOWCASE_LIMITS.slides} slides allowed` } as PostgrestError };
  }

  const { error: deleteError } = await supabase
    .from('startup_slides')
    .delete()
    .eq('startup_id', startupId);

  if (deleteError) return { error: deleteError };
  if (slides.length === 0) return { error: null };

  const { error } = await supabase
    .from('startup_slides')
    .insert(slides.map(s => ({ ...s, startup_id: startupId })));

  return { error };
}

// --- Links ---

export async function upsertLinks(
  startupId: string,
  links: { title: string; url: string; icon_name?: string; display_order: number }[]
): Promise<{ error: PostgrestError | null }> {
  if (links.length > SHOWCASE_LIMITS.links) {
    return { error: { message: `Maximum ${SHOWCASE_LIMITS.links} links allowed` } as PostgrestError };
  }

  const { error: deleteError } = await supabase
    .from('startup_links')
    .delete()
    .eq('startup_id', startupId);

  if (deleteError) return { error: deleteError };
  if (links.length === 0) return { error: null };

  const { error } = await supabase
    .from('startup_links')
    .insert(links.map(l => ({ ...l, startup_id: startupId })));

  return { error };
}

// --- Text Sections ---

export async function upsertTextSections(
  startupId: string,
  sections: { heading: string; content: string; display_order: number }[]
): Promise<{ error: PostgrestError | null }> {
  if (sections.length > SHOWCASE_LIMITS.sections) {
    return { error: { message: `Maximum ${SHOWCASE_LIMITS.sections} sections allowed` } as PostgrestError };
  }

  const { error: deleteError } = await supabase
    .from('startup_text_sections')
    .delete()
    .eq('startup_id', startupId);

  if (deleteError) return { error: deleteError };
  if (sections.length === 0) return { error: null };

  const { error } = await supabase
    .from('startup_text_sections')
    .insert(sections.map(s => ({ ...s, startup_id: startupId })));

  return { error };
}

// --- Slide Image Upload ---

export async function uploadSlideImage(file: File): Promise<{ url: string; error?: string }> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `startup-slides/${userId}/${fileName}`;

    const { error: storageError } = await supabase.storage
      .from('media')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (storageError) throw storageError;

    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl };
  } catch (error) {
    console.error('Error uploading slide image:', error);
    return { url: '', error: error instanceof Error ? error.message : 'Failed to upload slide' };
  }
}

// --- File Uploads ---

export async function uploadPitchDeck(file: File): Promise<{ url: string; error?: string }> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `pitch-decks/${userId}/${fileName}`;

    const { error: storageError } = await supabase.storage
      .from('media')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (storageError) throw storageError;

    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl };
  } catch (error) {
    console.error('Error uploading pitch deck:', error);
    return { url: '', error: error instanceof Error ? error.message : 'Failed to upload pitch deck' };
  }
}

export async function uploadPitchVideo(file: File): Promise<{ url: string; error?: string }> {
  try {
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_VIDEO_SIZE) {
      return { url: '', error: `Video too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is 50MB.` };
    }

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const ext = file.name.split('.').pop() || 'mp4';
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `pitch-videos/${userId}/${fileName}`;

    // Upload the File directly (not ArrayBuffer) — let Supabase client handle encoding
    const { error: storageError } = await supabase.storage
      .from('media')
      .upload(filePath, file, {
        upsert: true,
      });

    if (storageError) throw storageError;

    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl };
  } catch (error: unknown) {
    console.error('Error uploading pitch video:', error);
    const msg = error instanceof Error ? error.message : 'Failed to upload video';
    return { url: '', error: msg };
  }
}

export async function uploadStartupImage(file: File, type: 'logo' | 'banner'): Promise<{ url: string; error?: string }> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `startup-images/${userId}/${type}/${fileName}`;

    const { error: storageError } = await supabase.storage
      .from('media')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (storageError) throw storageError;

    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl };
  } catch (error) {
    console.error(`Error uploading startup ${type}:`, error);
    return { url: '', error: error instanceof Error ? error.message : `Failed to upload ${type}` };
  }
}
