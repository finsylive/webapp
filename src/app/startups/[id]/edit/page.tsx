"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Step1Identity } from '@/components/startups/Step1Identity';
import { Step2Description } from '@/components/startups/Step2Description';
import { Step3Branding } from '@/components/startups/Step3Branding';
import { Step4Positioning } from '@/components/startups/Step4Positioning';
import { Step5Edge } from '@/components/startups/Step5Edge';
import { Step6Financials } from '@/components/startups/Step6Financials';
import { Step7Media } from '@/components/startups/Step7Media';
import {
  fetchStartupById, updateStartup, upsertFundingRounds,
  uploadPitchDeck, uploadPitchVideo, uploadStartupImage, StartupProfile,
  upsertTextSections, upsertLinks, upsertSlides,
} from '@/api/startups';
import type { EntityType } from '@/api/startups';
import { StepShowcase } from '@/components/startups/StepShowcase';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function EditStartupPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploadingDeck, setIsUploadingDeck] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [profileData, setProfileData] = useState({
    brand_name: '', registered_name: '', legal_status: 'not_registered', cin: '',
    stage: 'ideation', description: '', keywords: [] as string[], website: '',
    founded_date: '', address_line1: '', address_line2: '', startup_email: '',
    startup_phone: '', pitch_deck_url: '', pitch_video_url: '', is_actively_raising: false,
    business_model: '', city: '', state: '', country: '', categories: [] as string[],
    team_size: '', key_strengths: '', target_audience: '',
    revenue_amount: '', revenue_currency: 'USD', revenue_growth: '',
    traction_metrics: '', total_raised: '', investor_count: '',
    elevator_pitch: '', logo_url: '', banner_url: '',
    raise_target: '', equity_offered: '', min_ticket_size: '',
    funding_stage: '', sector: '',
  });

  const [entityType, setEntityType] = useState<EntityType>('startup');
  const [founders, setFounders] = useState<{ name: string; role: string; email: string; user_id: string; ments_username: string; avatar_url: string; display_order: number }[]>([]);
  const [fundingRounds, setFundingRounds] = useState<{ investor: string; amount: string; round_type: string; round_date: string; is_public: boolean }[]>([]);
  const [textSections, setTextSections] = useState<{ heading: string; content: string; display_order: number }[]>([]);
  const [links, setLinks] = useState<{ title: string; url: string; display_order: number }[]>([]);
  const [slides, setSlides] = useState<{ slide_url: string; caption?: string; slide_number: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await fetchStartupById(id, user?.id);
      if (!data) {
        setError('Startup not found');
        setLoading(false);
        return;
      }
      const isOwner = data.owner_id === user?.id;
      const isCofounder = !isOwner && (data.founders || []).some(
        f => f.user_id === user?.id && f.status === 'accepted'
      );
      if (!isOwner && !isCofounder) {
        setError('You do not have access to edit this startup');
        setLoading(false);
        return;
      }

      setEntityType(data.entity_type || 'startup');
      setProfileData({
        brand_name: data.brand_name, registered_name: data.registered_name || '',
        legal_status: data.legal_status, cin: data.cin || '',
        stage: data.stage, description: data.description || '',
        keywords: data.keywords || [], website: data.website || '',
        founded_date: data.founded_date || '', address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        startup_email: data.startup_email || '', startup_phone: data.startup_phone || '',
        pitch_deck_url: data.pitch_deck_url || '',
        pitch_video_url: data.pitch_video_url || '',
        is_actively_raising: data.is_actively_raising,
        business_model: data.business_model || '', city: data.city || '',
        state: data.state || '', country: data.country || '', categories: data.categories || [],
        team_size: data.team_size || '', key_strengths: data.key_strengths || '',
        target_audience: data.target_audience || '',
        revenue_amount: data.revenue_amount || '', revenue_currency: data.revenue_currency || 'USD',
        revenue_growth: data.revenue_growth || '', traction_metrics: data.traction_metrics || '',
        total_raised: data.total_raised || '',
        investor_count: data.investor_count?.toString() || '',
        elevator_pitch: data.elevator_pitch || '',
        logo_url: data.logo_url || '', banner_url: data.banner_url || '',
        raise_target: data.raise_target || '', equity_offered: data.equity_offered || '',
        min_ticket_size: data.min_ticket_size || '', funding_stage: data.funding_stage || '',
        sector: data.sector || '',
      });

      if (data.founders) {
        setFounders(data.founders.map(f => ({
          name: f.name, role: f.role || '', email: f.email || '', user_id: f.user_id || '', ments_username: f.ments_username || '', avatar_url: f.avatar_url || '', display_order: f.display_order,
        })));
      }
      if (data.funding_rounds) {
        setFundingRounds(data.funding_rounds.map(r => ({
          investor: r.investor || '', amount: r.amount || '',
          round_type: r.round_type || '', round_date: r.round_date || '', is_public: r.is_public,
        })));
      }
      if (data.text_sections) {
        setTextSections(data.text_sections.map(s => ({
          heading: s.heading, content: s.content, display_order: s.display_order,
        })));
      }
      if (data.links) {
        setLinks(data.links.map(l => ({
          title: l.title, url: l.url, display_order: l.display_order,
        })));
      }
      if (data.slides) {
        setSlides(data.slides.map(s => ({
          slide_url: s.slide_url, caption: s.caption || '', slide_number: s.slide_number,
        })));
      }
      setLoading(false);
    };
    if (user) load();
  }, [id, user]);

  const handleProfileChange = (field: string, value: string | string[] | boolean) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handlePitchDeckUpload = async (file: File) => {
    setIsUploadingDeck(true);
    const { url, error } = await uploadPitchDeck(file);
    setIsUploadingDeck(false);
    if (error) setError(error);
    else setProfileData(prev => ({ ...prev, pitch_deck_url: url }));
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    const { url, error } = await uploadStartupImage(file, 'logo');
    setIsUploadingLogo(false);
    if (error) setError(error);
    else setProfileData(prev => ({ ...prev, logo_url: url }));
  };

  const handleBannerUpload = async (file: File) => {
    setIsUploadingBanner(true);
    const { url, error } = await uploadStartupImage(file, 'banner');
    setIsUploadingBanner(false);
    if (error) setError(error);
    else setProfileData(prev => ({ ...prev, banner_url: url }));
  };

  const handlePitchVideoUpload = async (file: File) => {
    setIsUploadingVideo(true);
    const { url, error } = await uploadPitchVideo(file);
    setIsUploadingVideo(false);
    if (error) setError(error);
    else setProfileData(prev => ({ ...prev, pitch_video_url: url }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const isOrgProject = entityType === 'org_project';

    try {
      const { error: updateError } = await updateStartup(id, {
        brand_name: profileData.brand_name,
        registered_name: isOrgProject ? null : (profileData.registered_name || null),
        legal_status: profileData.legal_status as StartupProfile['legal_status'],
        cin: isOrgProject ? null : (profileData.cin || null),
        stage: profileData.stage as StartupProfile['stage'],
        description: profileData.description || null,
        keywords: profileData.keywords,
        website: profileData.website || null,
        founded_date: profileData.founded_date || null,
        address_line1: profileData.address_line1 || null,
        address_line2: profileData.address_line2 || null,
        state: profileData.state || null,
        startup_email: isOrgProject ? (profileData.startup_email || null) : (profileData.startup_email || null),
        startup_phone: isOrgProject ? null : (profileData.startup_phone || null),
        pitch_deck_url: isOrgProject ? null : (profileData.pitch_deck_url || null),
        is_actively_raising: isOrgProject ? false : profileData.is_actively_raising,
        business_model: isOrgProject ? null : (profileData.business_model || null),
        city: profileData.city || null,
        country: profileData.country || null,
        categories: profileData.categories,
        team_size: profileData.team_size || null,
        key_strengths: isOrgProject ? null : (profileData.key_strengths || null),
        target_audience: isOrgProject ? null : (profileData.target_audience || null),
        revenue_amount: isOrgProject ? null : (profileData.revenue_amount || null),
        revenue_currency: isOrgProject ? null : (profileData.revenue_currency || null),
        revenue_growth: isOrgProject ? null : (profileData.revenue_growth || null),
        traction_metrics: isOrgProject ? null : (profileData.traction_metrics || null),
        total_raised: isOrgProject ? null : (profileData.total_raised || null),
        investor_count: isOrgProject ? null : (profileData.investor_count ? parseInt(profileData.investor_count) : null),
        elevator_pitch: profileData.elevator_pitch || null,
        logo_url: profileData.logo_url || null,
        banner_url: profileData.banner_url || null,
        pitch_video_url: profileData.pitch_video_url || null,
        raise_target: isOrgProject ? null : (profileData.raise_target || null),
        equity_offered: isOrgProject ? null : (profileData.equity_offered || null),
        min_ticket_size: isOrgProject ? null : (profileData.min_ticket_size || null),
        funding_stage: isOrgProject ? null : ((profileData.funding_stage || null) as StartupProfile['funding_stage']),
        sector: isOrgProject ? null : (profileData.sector || null),
      });

      if (updateError) throw new Error(updateError.message);

      const saveOps: Promise<unknown>[] = [
        fetch(`/api/startups/${id}/founders`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            founders: founders.filter(f => f.name).map(f => ({
              name: f.name,
              role: f.role || null,
              email: f.email || null,
              user_id: f.user_id || null,
              ments_username: f.ments_username || null,
              avatar_url: f.avatar_url || null,
              display_order: f.display_order,
            })),
            startupName: profileData.brand_name,
          }),
        }).then(async r => {
          if (!r.ok) {
            const d = await r.json();
            throw new Error(d.error || 'Failed to save founders');
          }
        }),
      ];

      if (!isOrgProject) {
        saveOps.push(upsertFundingRounds(id, fundingRounds.filter(r => r.round_type || r.amount || r.investor)));
      }

      // Save showcase content (text sections, links, slides)
      saveOps.push(upsertTextSections(id, textSections.filter(s => s.heading && s.content)));
      saveOps.push(upsertLinks(id, links.filter(l => l.title && l.url)));
      saveOps.push(upsertSlides(id, slides.filter(s => s.slide_url)));

      await Promise.all(saveOps);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/startups/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to delete startup');
        setShowDeleteConfirm(false);
      } else {
        router.push('/startups');
      }
    } catch {
      setError('Failed to delete startup');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !profileData.brand_name) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-red-500">{error}</p>
          <Link href="/startups" className="mt-4 text-sm text-primary hover:underline">Back to Startups</Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href={`/startups/${id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Profile
          </Link>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600">{error}</div>
        )}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-600">Changes saved successfully!</div>
        )}

        <div className="space-y-8">
          <Step1Identity data={profileData} onChange={handleProfileChange} entityType={entityType} />
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <Step2Description data={profileData} founders={founders} onChange={handleProfileChange} onFoundersChange={setFounders} entityType={entityType} />
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <Step3Branding
            logoUrl={profileData.logo_url}
            bannerUrl={profileData.banner_url}
            isUploadingLogo={isUploadingLogo}
            isUploadingBanner={isUploadingBanner}
            onLogoUpload={handleLogoUpload}
            onBannerUpload={handleBannerUpload}
            onRemoveLogo={() => handleProfileChange('logo_url', '')}
            onRemoveBanner={() => handleProfileChange('banner_url', '')}
          />

          {/* Showcase: Text Sections, Slides & Links — available for all entity types */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <StepShowcase
            textSections={textSections}
            links={links}
            slides={slides}
            onTextSectionsChange={setTextSections}
            onLinksChange={setLinks}
            onSlidesChange={setSlides}
          />

          {/* Startup-only steps */}
          {entityType !== 'org_project' && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <Step4Positioning data={profileData} onChange={handleProfileChange} />
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <Step5Edge data={profileData} onChange={handleProfileChange} />
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <Step6Financials
                data={profileData}
                fundingRounds={fundingRounds}
                onChange={handleProfileChange}
                onFundingChange={setFundingRounds}
              />
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              <Step7Media
                data={profileData}
                isUploadingDeck={isUploadingDeck}
                isUploadingVideo={isUploadingVideo}
                onChange={handleProfileChange}
                onPitchDeckUpload={handlePitchDeckUpload}
                onPitchVideoUpload={handlePitchVideoUpload}
              />
            </>
          )}
        </div>

        {/* Sticky save bar */}
        <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-sm border-t border-border/50">
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 mb-20 p-4 sm:p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
          <h3 className="text-sm font-semibold text-red-500 mb-1">Danger Zone</h3>
          <p className="text-xs text-muted-foreground mb-3">Permanently delete this startup. This action cannot be undone.</p>
          {showDeleteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                This will permanently delete <strong>{profileData.brand_name || 'this startup'}</strong>, including all funding rounds, team associations, media, and analytics data.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Yes, delete permanently
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-accent/50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete Startup
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

