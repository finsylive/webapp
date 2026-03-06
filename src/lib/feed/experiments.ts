import type { SupabaseClient } from '@supabase/supabase-js';
import { EXPERIMENT_BUCKET_COUNT } from './constants';
import type { FeedExperiment, ExperimentVariant } from './types';

/**
 * Deterministic hash-based user bucketing for experiment assignment.
 */
function hashBucket(experimentId: string, userId: string): number {
  const str = experimentId + userId;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % EXPERIMENT_BUCKET_COUNT;
}

/**
 * Assign a user to an experiment variant based on deterministic hashing.
 */
function assignVariant(experiment: FeedExperiment, userId: string): ExperimentVariant | null {
  const variants = experiment.variants;
  if (!variants || variants.length === 0) return null;

  const bucket = hashBucket(experiment.id!, userId);
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += (variant.weight / totalWeight) * EXPERIMENT_BUCKET_COUNT;
    if (bucket < cumulative) {
      return variant;
    }
  }

  return variants[variants.length - 1];
}

/**
 * Get active experiment config for a user.
 * Returns the experiment ID, variant, and config overrides.
 */
export async function getExperimentConfig(
  supabase: SupabaseClient,
  userId: string
): Promise<{ experimentId: string; variant: string; config: Record<string, number> } | null> {
  try {
  // Get active experiments
  const { data: experiments, error: expError } = await supabase
    .from('feed_experiments')
    .select('*')
    .eq('status', 'active')
    .limit(1);

  if (expError || !experiments || experiments.length === 0) return null;

  const experiment = experiments[0] as FeedExperiment;

  // Check if user is already assigned
  const { data: existing } = await supabase
    .from('feed_experiment_assignments')
    .select('variant_id')
    .eq('experiment_id', experiment.id!)
    .eq('user_id', userId)
    .single();

  let variantId: string;

  if (existing) {
    variantId = existing.variant_id;
  } else {
    // Assign via deterministic bucketing
    const variant = assignVariant(experiment, userId);
    if (!variant) return null;

    variantId = variant.id;

    // Persist assignment (ignore conflicts)
    try {
      await supabase.from('feed_experiment_assignments').insert({
        experiment_id: experiment.id!,
        user_id: userId,
        variant_id: variantId,
      });
    } catch { /* ignore */ }
  }

  // Find the variant config
  const variant = experiment.variants.find((v) => v.id === variantId);
  if (!variant) return null;

  return {
    experimentId: experiment.id!,
    variant: variant.id,
    config: variant.config,
  };
  } catch (err) {
    console.warn('getExperimentConfig failed (non-critical):', err);
    return null;
  }
}

/**
 * Get all experiments with their status.
 */
export async function getExperiments(supabase: SupabaseClient): Promise<FeedExperiment[]> {
  const { data } = await supabase
    .from('feed_experiments')
    .select('*')
    .order('created_at', { ascending: false });

  return (data || []) as FeedExperiment[];
}

/**
 * Create a new experiment.
 */
export async function createExperiment(supabase: SupabaseClient, experiment: Omit<FeedExperiment, 'id' | 'created_at'>): Promise<FeedExperiment | null> {
  const { data, error } = await supabase
    .from('feed_experiments')
    .insert({
      name: experiment.name,
      description: experiment.description,
      status: experiment.status || 'draft',
      variants: experiment.variants,
      targeting_rules: experiment.targeting_rules || {},
      metrics: experiment.metrics,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating experiment:', error);
    return null;
  }

  return data as FeedExperiment;
}

/**
 * Update an experiment (start/pause/end).
 */
export async function updateExperiment(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<FeedExperiment>
): Promise<FeedExperiment | null> {
  const updateData: Record<string, unknown> = {};
  if (updates.status) {
    updateData.status = updates.status;
    if (updates.status === 'active') updateData.started_at = new Date().toISOString();
    if (updates.status === 'ended') updateData.ended_at = new Date().toISOString();
  }
  if (updates.name) updateData.name = updates.name;
  if (updates.description) updateData.description = updates.description;
  if (updates.variants) updateData.variants = updates.variants;
  if (updates.metrics) updateData.metrics = updates.metrics;

  const { data, error } = await supabase
    .from('feed_experiments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating experiment:', error);
    return null;
  }

  return data as FeedExperiment;
}
