"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createStartup, upsertFounders, upsertFundingRounds, upsertIncubators, upsertAwards, uploadPitchDeck } from '@/api/startups';
import { Step1BasicIdentity } from './Step1BasicIdentity';
import { Step2CurrentStage } from './Step2CurrentStage';
import { Step3ProfileDetails } from './Step3ProfileDetails';
import { Step4Team } from './Step4Team';
import { Step5FundingRecognition } from './Step5FundingRecognition';
import { StartupPreview } from './StartupPreview';
import { ChevronLeft, ChevronRight, Eye, Send } from 'lucide-react';

const STEPS = ['Identity', 'Stage', 'Details', 'Team', 'Funding', 'Preview'];

export function StartupCreateWizard() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingDeck, setIsUploadingDeck] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [profileData, setProfileData] = useState({
    brand_name: '', registered_name: '', legal_status: 'not_registered', cin: '',
    stage: 'ideation', description: '', keywords: [] as string[], website: '',
    founded_date: '', registered_address: '', startup_email: user?.email || '',
    startup_phone: '', pitch_deck_url: '', is_actively_raising: false,
  });

  const [founders, setFounders] = useState<{ name: string; linkedin_url: string; display_order: number }[]>([]);
  const [fundingRounds, setFundingRounds] = useState<{ investor: string; amount: string; round_type: string; round_date: string; is_public: boolean }[]>([]);
  const [incubators, setIncubators] = useState<{ program_name: string; year: number | '' }[]>([]);
  const [awards, setAwards] = useState<{ award_name: string; year: number | '' }[]>([]);

  const handleProfileChange = (field: string, value: string | string[] | boolean) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

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

  const canProceed = () => {
    switch (step) {
      case 0: return profileData.brand_name.trim() && profileData.legal_status;
      case 1: return profileData.stage;
      case 2: return profileData.startup_email.trim() && profileData.startup_phone.trim();
      default: return true;
    }
  };

  const handleSubmit = async (publish: boolean) => {
    if (!user) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: startup, error: createError } = await createStartup({
        owner_id: user.id,
        brand_name: profileData.brand_name,
        registered_name: profileData.registered_name || null,
        legal_status: profileData.legal_status as 'llp' | 'pvt_ltd' | 'sole_proprietorship' | 'not_registered',
        cin: profileData.cin || null,
        stage: profileData.stage as 'ideation' | 'mvp' | 'scaling' | 'expansion' | 'maturity',
        description: profileData.description || null,
        keywords: profileData.keywords,
        website: profileData.website || null,
        founded_date: profileData.founded_date || null,
        registered_address: profileData.registered_address || null,
        startup_email: profileData.startup_email,
        startup_phone: profileData.startup_phone,
        pitch_deck_url: profileData.pitch_deck_url || null,
        is_actively_raising: profileData.is_actively_raising,
        visibility: 'public',
        is_published: publish,
      });

      if (createError) throw new Error(createError.message);
      if (!startup) throw new Error('Failed to create startup');

      // Save related data in parallel
      const promises = [];

      if (founders.length > 0) {
        promises.push(upsertFounders(startup.id, founders.map(f => ({
          name: f.name, linkedin_url: f.linkedin_url || undefined, display_order: f.display_order,
        }))));
      }
      if (fundingRounds.length > 0) {
        promises.push(upsertFundingRounds(startup.id, fundingRounds.filter(r => r.round_type || r.amount || r.investor)));
      }
      if (incubators.length > 0) {
        promises.push(upsertIncubators(startup.id, incubators.filter(i => i.program_name).map(i => ({
          program_name: i.program_name, year: i.year || undefined,
        }))));
      }
      if (awards.length > 0) {
        promises.push(upsertAwards(startup.id, awards.filter(a => a.award_name).map(a => ({
          award_name: a.award_name, year: a.year || undefined,
        }))));
      }

      await Promise.all(promises);

      router.push(publish ? `/startups/${startup.id}` : '/startups/my');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => { if (i < step) setStep(i); }}
              className={`text-xs font-medium transition-colors ${
                i === step ? 'text-primary' : i < step ? 'text-foreground cursor-pointer hover:text-primary' : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 0 && (
          <Step1BasicIdentity data={profileData} onChange={handleProfileChange} />
        )}
        {step === 1 && (
          <Step2CurrentStage data={profileData} onChange={handleProfileChange} />
        )}
        {step === 2 && (
          <Step3ProfileDetails
            data={profileData}
            onChange={handleProfileChange}
            onPitchDeckUpload={handlePitchDeckUpload}
            isUploadingDeck={isUploadingDeck}
          />
        )}
        {step === 3 && (
          <Step4Team founders={founders} onChange={setFounders} />
        )}
        {step === 4 && (
          <Step5FundingRecognition
            fundingRounds={fundingRounds}
            incubators={incubators}
            awards={awards}
            isActivelyRaising={profileData.is_actively_raising}
            onFundingChange={setFundingRounds}
            onIncubatorsChange={setIncubators}
            onAwardsChange={setAwards}
            onRaisingChange={(v) => handleProfileChange('is_actively_raising', v)}
          />
        )}
        {step === 5 && (
          <StartupPreview
            data={profileData}
            founders={founders}
            fundingRounds={fundingRounds}
            incubators={incubators}
            awards={awards}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-muted text-foreground rounded-xl hover:bg-accent transition-colors disabled:opacity-50"
              >
                <Eye className="h-4 w-4" /> Save Draft
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publish
              </button>
            </>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed() || isUploadingDeck}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
