import { supabase } from '@/utils/supabase';
import { PostgrestError } from '@supabase/supabase-js';

export type InvestorDeal = {
  id: string;
  investor_id: string;
  startup_id: string;
  stage: 'watching' | 'interested' | 'in_talks' | 'due_diligence' | 'invested' | 'referred' | 'passed';
  notes: string | null;
  invested_amount: string | null;
  invested_date: string | null;
  instrument: 'safe' | 'equity' | 'convertible_note' | 'other' | null;
  created_at: string;
  updated_at: string;
  // Joined startup data
  startup?: {
    id: string;
    brand_name: string;
    logo_url: string | null;
    stage: string;
    city: string | null;
    sector: string | null;
    is_actively_raising: boolean;
    elevator_pitch: string | null;
  };
};

export type DealResponse = {
  data: InvestorDeal | null;
  error: PostgrestError | null;
};

export type DealsResponse = {
  data: InvestorDeal[] | null;
  error: PostgrestError | null;
};

export async function fetchDealFlow(investorId: string): Promise<DealsResponse> {
  try {
    const { data, error } = await supabase
      .from('investor_deals')
      .select(`
        *,
        startup:startup_profiles (
          id, brand_name, logo_url, stage, city, sector, is_actively_raising, elevator_pitch
        )
      `)
      .eq('investor_id', investorId)
      .order('updated_at', { ascending: false });

    if (error) return { data: null, error };
    return { data: data as InvestorDeal[], error: null };
  } catch (err) {
    console.error('Error fetching deal flow:', err);
    return { data: null, error: err as PostgrestError };
  }
}

export async function createDeal(investorId: string, startupId: string): Promise<DealResponse> {
  try {
    const { data, error } = await supabase
      .from('investor_deals')
      .insert({ investor_id: investorId, startup_id: startupId, stage: 'watching' })
      .select(`
        *,
        startup:startup_profiles (
          id, brand_name, logo_url, stage, city, sector, is_actively_raising, elevator_pitch
        )
      `)
      .single();

    if (error) return { data: null, error };
    return { data: data as InvestorDeal, error: null };
  } catch (err) {
    console.error('Error creating deal:', err);
    return { data: null, error: err as PostgrestError };
  }
}

export async function updateDealStage(dealId: string, stage: string): Promise<DealResponse> {
  try {
    const { data, error } = await supabase
      .from('investor_deals')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', dealId)
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: data as InvestorDeal, error: null };
  } catch (err) {
    console.error('Error updating deal stage:', err);
    return { data: null, error: err as PostgrestError };
  }
}

export async function addDealNote(dealId: string, actorId: string, note: string): Promise<{ error: PostgrestError | null }> {
  try {
    const { error } = await supabase
      .from('investor_deal_activity')
      .insert({
        deal_id: dealId,
        actor_id: actorId,
        activity_type: 'note_added',
        content: note,
      });

    return { error };
  } catch (err) {
    console.error('Error adding deal note:', err);
    return { error: err as PostgrestError };
  }
}

export async function removeDeal(dealId: string): Promise<{ error: PostgrestError | null }> {
  try {
    const { error } = await supabase
      .from('investor_deals')
      .delete()
      .eq('id', dealId);

    return { error };
  } catch (err) {
    console.error('Error removing deal:', err);
    return { error: err as PostgrestError };
  }
}

export async function getDealForStartup(investorId: string, startupId: string): Promise<DealResponse> {
  try {
    const { data, error } = await supabase
      .from('investor_deals')
      .select('*')
      .eq('investor_id', investorId)
      .eq('startup_id', startupId)
      .maybeSingle();

    if (error) return { data: null, error };
    return { data: data as InvestorDeal | null, error: null };
  } catch (err) {
    console.error('Error getting deal for startup:', err);
    return { data: null, error: err as PostgrestError };
  }
}
