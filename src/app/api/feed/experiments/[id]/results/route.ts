import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { zTestProportions, proportionCI, relativeChange } from '@/lib/feed/statistics';
import type { FeedExperiment, ExperimentResults, VariantResult, MetricResult } from '@/lib/feed/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const admin = await createAuthClient();

    // Fetch experiment
    const { data: experiment, error: expError } = await admin
      .from('feed_experiments')
      .select('*')
      .eq('id', id)
      .single();

    if (expError || !experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    const exp = experiment as FeedExperiment;
    const variants = exp.variants || [];

    if (variants.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 variants for results' }, { status: 400 });
    }

    // Compute metrics per variant
    const variantResults: VariantResult[] = [];

    for (const variant of variants) {
      // Get events for this variant
      const { data: events } = await admin
        .from('feed_events')
        .select('event_type, metadata')
        .eq('experiment_id', id)
        .eq('variant', variant.id);

      const allEvents = events || [];
      const impressions = allEvents.filter((e: { event_type: string }) => e.event_type === 'impression').length;
      const clicks = allEvents.filter((e: { event_type: string }) => e.event_type === 'click').length;
      const likes = allEvents.filter((e: { event_type: string }) => e.event_type === 'like').length;
      const replies = allEvents.filter((e: { event_type: string }) => e.event_type === 'reply').length;
      const shares = allEvents.filter((e: { event_type: string }) => e.event_type === 'share').length;
      const engagements = clicks + likes + replies + shares;

      const dwellEvents = allEvents.filter(
        (e: { event_type: string; metadata?: Record<string, unknown> }) =>
          e.event_type === 'dwell' && e.metadata?.dwell_ms
      );
      const avgDwell = dwellEvents.length > 0
        ? dwellEvents.reduce((sum: number, e: { metadata?: Record<string, unknown> }) => sum + (Number(e.metadata?.dwell_ms) || 0), 0) / dwellEvents.length
        : 0;

      const dwellVariance = dwellEvents.length > 1
        ? dwellEvents.reduce((sum: number, e: { metadata?: Record<string, unknown> }) => {
          const d = (Number(e.metadata?.dwell_ms) || 0) - avgDwell;
          return sum + d * d;
        }, 0) / (dwellEvents.length - 1)
        : 0;

      // Get unique users
      const { data: assignments } = await admin
        .from('feed_experiment_assignments')
        .select('user_id')
        .eq('experiment_id', id)
        .eq('variant_id', variant.id);

      const sampleSize = (assignments || []).length;

      const engagementRate = proportionCI(engagements, impressions);
      const ctr = proportionCI(clicks, impressions);

      const metrics: Record<string, MetricResult> = {
        engagement_rate: {
          value: engagementRate.value,
          ci_lower: engagementRate.lower,
          ci_upper: engagementRate.upper,
          is_significant: false,
        },
        ctr: {
          value: ctr.value,
          ci_lower: ctr.lower,
          ci_upper: ctr.upper,
          is_significant: false,
        },
        avg_dwell_ms: {
          value: avgDwell,
          ci_lower: avgDwell - 1.96 * Math.sqrt(dwellVariance / Math.max(1, dwellEvents.length)),
          ci_upper: avgDwell + 1.96 * Math.sqrt(dwellVariance / Math.max(1, dwellEvents.length)),
          is_significant: false,
        },
        impressions: {
          value: impressions,
          ci_lower: impressions,
          ci_upper: impressions,
          is_significant: false,
        },
      };

      variantResults.push({
        variant_id: variant.id,
        variant_name: variant.name,
        sample_size: sampleSize,
        metrics,
      });
    }

    // Run statistical tests between first variant (control) and others
    const control = variantResults[0];
    let anySignificant = false;
    let bestVariant = control.variant_id;
    let bestEngagement = control.metrics.engagement_rate.value;

    for (let i = 1; i < variantResults.length; i++) {
      const treatment = variantResults[i];

      // Z-test for engagement rate
      const erTest = zTestProportions(
        Math.round(control.metrics.engagement_rate.value * control.metrics.impressions.value),
        control.metrics.impressions.value,
        Math.round(treatment.metrics.engagement_rate.value * treatment.metrics.impressions.value),
        treatment.metrics.impressions.value
      );
      treatment.metrics.engagement_rate.p_value = erTest.pValue;
      treatment.metrics.engagement_rate.is_significant = erTest.isSignificant;
      treatment.metrics.engagement_rate.relative_change = relativeChange(
        control.metrics.engagement_rate.value,
        treatment.metrics.engagement_rate.value
      );

      // Z-test for CTR
      const ctrTest = zTestProportions(
        Math.round(control.metrics.ctr.value * control.metrics.impressions.value),
        control.metrics.impressions.value,
        Math.round(treatment.metrics.ctr.value * treatment.metrics.impressions.value),
        treatment.metrics.impressions.value
      );
      treatment.metrics.ctr.p_value = ctrTest.pValue;
      treatment.metrics.ctr.is_significant = ctrTest.isSignificant;
      treatment.metrics.ctr.relative_change = relativeChange(
        control.metrics.ctr.value,
        treatment.metrics.ctr.value
      );

      if (erTest.isSignificant || ctrTest.isSignificant) {
        anySignificant = true;
      }

      if (treatment.metrics.engagement_rate.value > bestEngagement) {
        bestEngagement = treatment.metrics.engagement_rate.value;
        bestVariant = treatment.variant_id;
      }
    }

    const results: ExperimentResults = {
      experiment: exp,
      variants: variantResults,
      is_significant: anySignificant,
      confidence_level: 0.95,
      winner: anySignificant ? bestVariant : undefined,
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error computing experiment results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
