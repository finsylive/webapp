"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Step1BasicIdentity } from '@/components/startups/Step1BasicIdentity';
import { Step2CurrentStage } from '@/components/startups/Step2CurrentStage';
import { Step3ProfileDetails } from '@/components/startups/Step3ProfileDetails';
import { Step4Team } from '@/components/startups/Step4Team';
import { Step5FundingRecognition } from '@/components/startups/Step5FundingRecognition';
import {
  fetchStartupById, updateStartup, upsertFounders, upsertFundingRounds,
  upsertIncubators, upsertAwards, uploadPitchDeck, StartupProfile,
} from '@/api/startups';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function EditStartupPage() {
  const { user } = useAuth();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploadingDeck, setIsUploadingDeck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [profileData, setProfileData] = useState({
    brand_name: '', registered_name: '', legal_status: 'not_registered', cin: '',
    stage: 'ideation', description: '', keywords: [] as string[], website: '',
    founded_date: '', registered_address: '', startup_email: '',
    startup_phone: '', pitch_deck_url: '', is_actively_raising: false,
  });

  const [founders, setFounders] = useState<{ name: string; linkedin_url: string; display_order: number }[]>([]);
  const [fundingRounds, setFundingRounds] = useState<{ investor: string; amount: string; round_type: string; round_date: string; is_public: boolean }[]>([]);
  const [incubators, setIncubators] = useState<{ program_name: string; year: number | '' }[]>([]);
  const [awards, setAwards] = useState<{ award_name: string; year: number | '' }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await fetchStartupById(id, user?.id);
      if (!data) {
        setError('Startup not found');
        setLoading(false);
        return;
      }
      if (data.owner_id !== user?.id) {
        setError('You do not own this startup');
        setLoading(false);
        return;
      }

      setProfileData({
        brand_name: data.brand_name, registered_name: data.registered_name || '',
        legal_status: data.legal_status, cin: data.cin || '',
        stage: data.stage, description: data.description || '',
        keywords: data.keywords || [], website: data.website || '',
        founded_date: data.founded_date || '', registered_address: data.registered_address || '',
        startup_email: data.startup_email, startup_phone: data.startup_phone,
        pitch_deck_url: data.pitch_deck_url || '',
        is_actively_raising: data.is_actively_raising,
      });

      if (data.founders) {
        setFounders(data.founders.map(f => ({
          name: f.name, linkedin_url: f.linkedin_url || '', display_order: f.display_order,
        })));
      }
      if (data.funding_rounds) {
        setFundingRounds(data.funding_rounds.map(r => ({
          investor: r.investor || '', amount: r.amount || '',
          round_type: r.round_type || '', round_date: r.round_date || '', is_public: r.is_public,
        })));
      }
      if (data.incubators) {
        setIncubators(data.incubators.map(i => ({ program_name: i.program_name, year: i.year || '' as number | '' })));
      }
      if (data.awards) {
        setAwards(data.awards.map(a => ({ award_name: a.award_name, year: a.year || '' as number | '' })));
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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateError } = await updateStartup(id, {
        brand_name: profileData.brand_name,
        registered_name: profileData.registered_name || null,
        legal_status: profileData.legal_status as StartupProfile['legal_status'],
        cin: profileData.cin || null,
        stage: profileData.stage as StartupProfile['stage'],
        description: profileData.description || null,
        keywords: profileData.keywords,
        website: profileData.website || null,
        founded_date: profileData.founded_date || null,
        registered_address: profileData.registered_address || null,
        startup_email: profileData.startup_email,
        startup_phone: profileData.startup_phone,
        pitch_deck_url: profileData.pitch_deck_url || null,
        is_actively_raising: profileData.is_actively_raising,
      });

      if (updateError) throw new Error(updateError.message);

      await Promise.all([
        upsertFounders(id, founders.filter(f => f.name).map(f => ({
          name: f.name, linkedin_url: f.linkedin_url || undefined, display_order: f.display_order,
        }))),
        upsertFundingRounds(id, fundingRounds.filter(r => r.round_type || r.amount || r.investor)),
        upsertIncubators(id, incubators.filter(i => i.program_name).map(i => ({
          program_name: i.program_name, year: i.year || undefined,
        }))),
        upsertAwards(id, awards.filter(a => a.award_name).map(a => ({
          award_name: a.award_name, year: a.year || undefined,
        }))),
      ]);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
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

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600">{error}</div>
        )}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-600">Changes saved successfully!</div>
        )}

        <div className="space-y-8">
          <Step1BasicIdentity data={profileData} onChange={handleProfileChange} />
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <Step2CurrentStage data={profileData} onChange={handleProfileChange} />
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <Step3ProfileDetails data={profileData} onChange={handleProfileChange} onPitchDeckUpload={handlePitchDeckUpload} isUploadingDeck={isUploadingDeck} />
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <Step4Team founders={founders} onChange={setFounders} />
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <Step5FundingRecognition
            fundingRounds={fundingRounds} incubators={incubators} awards={awards}
            isActivelyRaising={profileData.is_actively_raising}
            onFundingChange={setFundingRounds} onIncubatorsChange={setIncubators}
            onAwardsChange={setAwards} onRaisingChange={(v) => handleProfileChange('is_actively_raising', v)}
          />
        </div>

        {/* Bottom save */}
        <div className="flex justify-end pt-6 border-t border-border/50">
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
    </DashboardLayout>
  );
}
