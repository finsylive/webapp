"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createStartup, upsertFundingRounds, upsertTextSections, upsertLinks, upsertSlides, uploadPitchDeck, uploadPitchVideo, uploadStartupImage } from '@/api/startups';
import type { EntityType } from '@/api/startups';
import { Step1Identity } from './Step1Identity';
import { Step2Description } from './Step2Description';
import { Step3Branding } from './Step3Branding';
import { Step4Positioning } from './Step4Positioning';
import { Step5Edge } from './Step5Edge';
import { Step6Financials } from './Step6Financials';
import { Step7Media } from './Step7Media';
import { Step8Visibility } from './Step8Visibility';
import { StepShowcase } from './StepShowcase';
import { ChevronLeft, ChevronRight, Send, Check, FolderKanban, AlertCircle, Rocket } from 'lucide-react';

const STARTUP_STEPS = [
  { label: 'Identity', short: 'Identity' },
  { label: 'Description', short: 'Describe' },
  { label: 'Branding', short: 'Brand' },
  { label: 'Positioning', short: 'Position' },
  { label: 'Edge', short: 'Edge' },
  { label: 'Financials', short: 'Finance' },
  { label: 'Media', short: 'Media' },
  { label: 'Publish', short: 'Publish' },
];

const ORG_PROJECT_STEPS = [
  { label: 'Identity', short: 'Identity' },
  { label: 'Description', short: 'Describe' },
  { label: 'Branding', short: 'Brand' },
  { label: 'Showcase', short: 'Showcase' },
  { label: 'Publish', short: 'Publish' },
];

type Props = {
  entityType: EntityType;
};

export function StartupCreateWizard({ entityType }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const isOrgProject = entityType === 'org_project';
  const STEPS = isOrgProject ? ORG_PROJECT_STEPS : STARTUP_STEPS;
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingDeck, setIsUploadingDeck] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile data
  const [profileData, setProfileData] = useState({
    brand_name: '',
    registered_name: '',
    legal_status: 'not_registered',
    cin: '',
    stage: 'ideation',
    founded_date: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    country: '',
    startup_email: user?.email || '',
    startup_phone: '',
    business_model: '',
    description: '',
    keywords: [] as string[],
    categories: [] as string[],
    website: '',
    team_size: '',
    key_strengths: '',
    target_audience: '',
    revenue_amount: '',
    revenue_currency: 'USD',
    revenue_growth: '',
    traction_metrics: '',
    total_raised: '',
    investor_count: '',
    is_actively_raising: false,
    raise_target: '',
    equity_offered: '',
    min_ticket_size: '',
    funding_stage: '',
    sector: '',
    pitch_deck_url: '',
    pitch_video_url: '',
    elevator_pitch: '',
    logo_url: '',
    banner_url: '',
    visibility: 'public',
    confirmation: false,
  });

  // Related data
  const [founders, setFounders] = useState<{ name: string; role: string; email: string; user_id: string; ments_username: string; avatar_url: string; display_order: number }[]>([
    { name: '', role: '', email: '', user_id: '', ments_username: '', avatar_url: '', display_order: 0 },
  ]);
  const [fundingRounds, setFundingRounds] = useState<{ investor: string; amount: string; round_type: string; round_date: string; is_public: boolean }[]>([]);
  const [textSections, setTextSections] = useState<{ heading: string; content: string; display_order: number }[]>([]);
  const [showcaseLinks, setShowcaseLinks] = useState<{ title: string; url: string; display_order: number }[]>([]);
  const [showcaseSlides, setShowcaseSlides] = useState<{ slide_url: string; caption?: string; slide_number: number }[]>([]);

  const handleProfileChange = (field: string, value: string | string[] | boolean) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  // File uploads
  const handlePitchDeckUpload = async (file: File) => {
    setIsUploadingDeck(true);
    const { url, error } = await uploadPitchDeck(file);
    setIsUploadingDeck(false);
    if (error) {
      setError(error);
    } else {
      setProfileData(prev => ({ ...prev, pitch_deck_url: url }));
    }
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    const { url, error } = await uploadStartupImage(file, 'logo');
    setIsUploadingLogo(false);
    if (error) {
      setError(error);
    } else {
      setProfileData(prev => ({ ...prev, logo_url: url }));
    }
  };

  const handleBannerUpload = async (file: File) => {
    setIsUploadingBanner(true);
    const { url, error } = await uploadStartupImage(file, 'banner');
    setIsUploadingBanner(false);
    if (error) {
      setError(error);
    } else {
      setProfileData(prev => ({ ...prev, banner_url: url }));
    }
  };

  const handlePitchVideoUpload = async (file: File) => {
    setIsUploadingVideo(true);
    const { url, error } = await uploadPitchVideo(file);
    setIsUploadingVideo(false);
    if (error) {
      setError(error);
    } else {
      setProfileData(prev => ({ ...prev, pitch_video_url: url }));
    }
  };

  // Validation — step indices differ by entity type
  const canProceed = () => {
    const stepLabel = STEPS[step]?.label;
    switch (stepLabel) {
      case 'Identity':
        if (isOrgProject) {
          return profileData.brand_name.trim() && profileData.stage;
        }
        return profileData.brand_name.trim() && profileData.legal_status && profileData.startup_email.trim() && profileData.stage;
      case 'Description':
        return profileData.description.trim() && founders[0]?.name.trim();
      case 'Publish':
        return profileData.confirmation;
      default:
        return true;
    }
  };

  const isUploading = isUploadingDeck || isUploadingVideo || isUploadingLogo || isUploadingBanner;

  // Submit
  const handleSubmit = async () => {
    if (!user) return;
    if (!profileData.confirmation) {
      setError('Please confirm that the information is accurate.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const isPublish = profileData.visibility !== 'private';

      const { data: startup, error: createError } = await createStartup({
        owner_id: user.id,
        entity_type: entityType,
        brand_name: profileData.brand_name,
        registered_name: profileData.registered_name || null,
        legal_status: profileData.legal_status as 'llp' | 'pvt_ltd' | 'sole_proprietorship' | 'not_registered',
        cin: profileData.cin || null,
        stage: profileData.stage as 'ideation' | 'mvp' | 'scaling' | 'expansion' | 'maturity',
        description: profileData.description || null,
        keywords: profileData.keywords,
        website: profileData.website || null,
        founded_date: profileData.founded_date || null,
        address_line1: profileData.address_line1 || null,
        address_line2: profileData.address_line2 || null,
        state: profileData.state || null,
        startup_email: profileData.startup_email || null,
        startup_phone: profileData.startup_phone || null,
        pitch_deck_url: profileData.pitch_deck_url || null,
        is_actively_raising: isOrgProject ? false : profileData.is_actively_raising,
        visibility: profileData.visibility as 'public' | 'investors_only' | 'private',
        is_published: isPublish,
        is_featured: false,
        business_model: profileData.business_model || null,
        city: profileData.city || null,
        country: profileData.country || null,
        categories: profileData.categories,
        team_size: profileData.team_size || null,
        key_strengths: profileData.key_strengths || null,
        target_audience: profileData.target_audience || null,
        revenue_amount: isOrgProject ? null : profileData.revenue_amount || null,
        revenue_currency: isOrgProject ? null : profileData.revenue_currency || null,
        revenue_growth: isOrgProject ? null : profileData.revenue_growth || null,
        traction_metrics: isOrgProject ? null : profileData.traction_metrics || null,
        total_raised: isOrgProject ? null : profileData.total_raised || null,
        investor_count: isOrgProject ? null : (profileData.investor_count ? parseInt(profileData.investor_count) : null),
        elevator_pitch: profileData.elevator_pitch || null,
        logo_url: profileData.logo_url || null,
        banner_url: profileData.banner_url || null,
        pitch_video_url: profileData.pitch_video_url || null,
        raise_target: isOrgProject ? null : profileData.raise_target || null,
        equity_offered: isOrgProject ? null : profileData.equity_offered || null,
        min_ticket_size: isOrgProject ? null : profileData.min_ticket_size || null,
        funding_stage: isOrgProject ? null : (profileData.funding_stage || null) as 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c' | 'bridge' | null,
        sector: isOrgProject ? null : profileData.sector || null,
      });

      if (createError) throw new Error(createError.message);
      if (!startup) throw new Error('Failed to create startup');

      // Save related data in parallel
      const promises = [];

      const validFounders = founders.filter(f => f.name.trim());
      if (validFounders.length > 0) {
        promises.push(
          fetch(`/api/startups/${startup.id}/founders`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              founders: validFounders.map(f => ({
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
          })
        );
      }

      const validRounds = fundingRounds.filter(r => r.round_type || r.amount || r.investor);
      if (validRounds.length > 0) {
        promises.push(upsertFundingRounds(startup.id, validRounds));
      }

      const validSections = textSections.filter(s => s.heading.trim() && s.content.trim());
      if (validSections.length > 0) {
        promises.push(upsertTextSections(startup.id, validSections));
      }

      const validLinks = showcaseLinks.filter(l => l.title.trim() && l.url.trim());
      if (validLinks.length > 0) {
        promises.push(upsertLinks(startup.id, validLinks));
      }

      const validSlides = showcaseSlides.filter(s => s.slide_url);
      if (validSlides.length > 0) {
        promises.push(upsertSlides(startup.id, validSlides));
      }

      await Promise.all(promises);

      router.push(isPublish ? `/startups/${startup.id}` : '/startups/my');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      {/* Progress Steps */}
      <div className="mb-8">
        {/* Desktop step indicators */}
        <div className="hidden sm:block">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isOrgProject ? <FolderKanban className="h-4 w-4 text-primary" /> : <Rocket className="h-4 w-4 text-primary" />}
              <span className="text-sm font-semibold text-foreground">{STEPS[step].label}</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Step dots */}
          <div className="flex items-center justify-between mt-3">
            {STEPS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => { if (i < step) setStep(i); }}
                disabled={i > step}
                className="flex flex-col items-center gap-1 group"
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ${
                  i < step
                    ? 'bg-primary text-primary-foreground cursor-pointer group-hover:ring-2 group-hover:ring-primary/20'
                    : i === step
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/15'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium transition-colors ${
                  i === step ? 'text-primary' : i < step ? 'text-foreground' : 'text-muted-foreground/60'
                }`}>
                  {s.short}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile progress */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isOrgProject ? <FolderKanban className="h-3.5 w-3.5 text-primary" /> : <Rocket className="h-3.5 w-3.5 text-primary" />}
              <span className="text-sm font-semibold text-foreground">{STEPS[step].label}</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step Content Card */}
      <div className="bg-card border border-border/40 rounded-2xl p-6 sm:p-8 min-h-[420px] shadow-sm">
        {STEPS[step]?.label === 'Identity' && (
          <Step1Identity data={profileData} onChange={handleProfileChange} entityType={entityType} />
        )}
        {STEPS[step]?.label === 'Description' && (
          <Step2Description
            data={profileData}
            founders={founders}
            onChange={handleProfileChange}
            onFoundersChange={setFounders}
            entityType={entityType}
          />
        )}
        {STEPS[step]?.label === 'Branding' && (
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
        )}
        {STEPS[step]?.label === 'Positioning' && (
          <Step4Positioning data={profileData} onChange={handleProfileChange} />
        )}
        {STEPS[step]?.label === 'Edge' && (
          <Step5Edge data={profileData} onChange={handleProfileChange} />
        )}
        {STEPS[step]?.label === 'Financials' && (
          <Step6Financials
            data={profileData}
            fundingRounds={fundingRounds}
            onChange={handleProfileChange}
            onFundingChange={setFundingRounds}
          />
        )}
        {STEPS[step]?.label === 'Media' && (
          <Step7Media
            data={profileData}
            isUploadingDeck={isUploadingDeck}
            isUploadingVideo={isUploadingVideo}
            onChange={handleProfileChange}
            onPitchDeckUpload={handlePitchDeckUpload}
            onPitchVideoUpload={handlePitchVideoUpload}
          />
        )}
        {STEPS[step]?.label === 'Showcase' && (
          <StepShowcase
            textSections={textSections}
            links={showcaseLinks}
            slides={showcaseSlides}
            onTextSectionsChange={setTextSections}
            onLinksChange={setShowcaseLinks}
            onSlidesChange={setShowcaseSlides}
          />
        )}
        {STEPS[step]?.label === 'Publish' && (
          <Step8Visibility data={profileData} onChange={handleProfileChange} />
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 p-3.5 bg-red-500/10 border border-red-500/15 rounded-xl text-sm text-red-600 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 mb-8">
        <div>
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent/50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <div />
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.confirm('You have unsaved changes. Leave without saving?')) {
                router.push('/startups?tab=my');
              }
            }}
            className="px-4 py-2.5 text-sm font-medium text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            Exit
          </button>

          {step === STEPS.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all disabled:opacity-40 shadow-sm"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publish
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed() || isUploading}
              className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all disabled:opacity-40 shadow-sm"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
