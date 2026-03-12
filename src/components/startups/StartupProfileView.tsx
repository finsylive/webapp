"use client";

import { StartupProfile } from '@/api/startups';
import { toProxyUrl } from '@/utils/imageUtils';
import {
  Rocket, Globe, Mail, Phone, FileText, TrendingUp, Award,
  Building, Bookmark, BookmarkCheck, ExternalLink, Eye, MapPin,
  Calendar, Zap, Target,
  Briefcase, Hash, BrainCircuit, DraftingCompass, Globe2, Medal,
  ChevronRight, Mic, Clock, FolderKanban, Link2, Github, Linkedin,
  Twitter, Youtube, Info, Component, UsersRound, CircleDollarSign,
  Video
} from 'lucide-react';
import Link from 'next/link';

const stageLabels: Record<string, string> = {
  ideation: 'Ideation', mvp: 'MVP', scaling: 'Scaling', expansion: 'Expansion', maturity: 'Maturity',
};
const stageColors: Record<string, string> = {
  ideation: 'from-blue-500 to-cyan-500',
  mvp: 'from-purple-500 to-pink-500',
  scaling: 'from-green-500 to-emerald-500',
  expansion: 'from-orange-500 to-amber-500',
  maturity: 'from-red-500 to-rose-500',
};
const stageIcons: Record<string, typeof Rocket> = {
  ideation: BrainCircuit,
  mvp: DraftingCompass,
  scaling: Zap,
  expansion: Globe2,
  maturity: Medal,
};

// Helper to get icon based on URL
const getLinkIcon = (url: string) => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('github.com')) return Github;
  if (lowerUrl.includes('linkedin.com')) return Linkedin;
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return Twitter;
  if (lowerUrl.includes('youtube.com')) return Youtube;
  return ExternalLink;
};
const legalLabels: Record<string, string> = {
  llp: 'LLP', pvt_ltd: 'Pvt Ltd', sole_proprietorship: 'Sole Proprietorship', not_registered: 'Not Registered',
};
const roundLabels: Record<string, string> = {
  pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A', series_b: 'Series B', series_c: 'Series C', other: 'Other',
};
const businessModelLabels: Record<string, string> = {
  B2B: 'B2B', B2C: 'B2C', B2B2C: 'B2B2C',
};

type Props = {
  startup: StartupProfile;
  isOwner?: boolean;
  isCofounder?: boolean;
  onBookmark?: () => void;
  onUnbookmark?: () => void;
};

// Helper: build location string
function buildLocation(startup: StartupProfile): string | null {
  const parts = [startup.city, startup.state, startup.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// Helper: check if there's any financial data
function hasFinancialData(startup: StartupProfile): boolean {
  return !!(
    startup.revenue_amount || startup.traction_metrics ||
    startup.total_raised || startup.investor_count ||
    (startup.funding_rounds && startup.funding_rounds.length > 0)
  );
}

// Helper: check if there's any "about" content beyond description
function hasPositioningData(startup: StartupProfile): boolean {
  return !!(
    startup.key_strengths || startup.target_audience
  );
}

// Helper: check if there's any contact data worth showing
function hasContactDetails(startup: StartupProfile): boolean {
  return !!(
    startup.startup_email || startup.startup_phone || startup.website ||
    startup.pitch_deck_url || startup.founded_date || startup.address_line1
  );
}

export function StartupProfileView({ startup, isOwner, isCofounder, onBookmark, onUnbookmark }: Props) {
  const location = buildLocation(startup);
  const StageIcon = stageIcons[startup.stage] || Rocket;
  const isOrgProject = startup.entity_type === 'org_project';

  return (
    <div className="space-y-5">
      {/* ─── Hero Card with integrated Banner ─── */}
      <div className="bg-card/70 backdrop-blur-xl border border-border/40 rounded-3xl shadow-xl relative overflow-hidden">
        {/* Banner */}
        {startup.banner_url ? (
          <div className="w-full h-44 sm:h-52">
            <img src={startup.banner_url} alt="Banner" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`w-full h-24 sm:h-32 bg-gradient-to-br ${stageColors[startup.stage] || 'from-primary/30 to-primary/10'} opacity-40`} />
        )}

        {/* Content area */}
        <div className="relative px-6 sm:px-8 pb-6 sm:pb-8">
          {/* Subtle accent gradient */}
          <div className={`absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br ${stageColors[startup.stage]} opacity-[0.06] blur-3xl rounded-full`} />

          <div className="relative flex flex-col sm:flex-row items-start gap-5">
            {/* Logo or Stage Icon — overlapping the banner */}
            {startup.logo_url ? (
              <img
                src={startup.logo_url}
                alt={startup.brand_name}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover border-4 border-card shadow-lg flex-shrink-0 -mt-12 sm:-mt-14 bg-card"
              />
            ) : (
              <div className={`flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl bg-gradient-to-br ${stageColors[startup.stage] || 'from-primary to-primary/80'} shadow-lg flex-shrink-0 -mt-12 sm:-mt-14 border-4 border-card`}>
                <StageIcon className="h-9 w-9 text-white" />
              </div>
            )}

          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">{startup.brand_name}</h1>
                {startup.registered_name && (
                  <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5" />
                    {startup.registered_name}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isOrgProject && startup.is_actively_raising && (
                  <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm">
                    <TrendingUp className="h-3.5 w-3.5" /> Raising
                  </span>
                )}
                {(isOwner || isCofounder) ? (
                  <Link
                    href={`/startups/${startup.id}/edit`}
                    className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    Edit Profile
                  </Link>
                ) : (
                  <button
                    onClick={startup.is_bookmarked ? onUnbookmark : onBookmark}
                    className={`p-2.5 rounded-xl border transition-all shadow-sm active:scale-95 ${
                      startup.is_bookmarked
                        ? 'border-primary/30 bg-primary/10'
                        : 'border-border bg-background/50 hover:bg-accent'
                    }`}
                  >
                    {startup.is_bookmarked ? (
                      <BookmarkCheck className="h-5 w-5 text-primary" />
                    ) : (
                      <Bookmark className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Meta badges */}
            <div className="flex items-center flex-wrap gap-2.5 mt-5">
              {isOrgProject && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <FolderKanban className="h-3.5 w-3.5" />
                  Org Project
                </span>
              )}

              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r ${stageColors[startup.stage] || 'from-primary to-primary/80'} text-white shadow-sm`}>
                <StageIcon className="h-3.5 w-3.5" />
                {stageLabels[startup.stage] || startup.stage}
              </span>

              {!isOrgProject && startup.legal_status && startup.legal_status !== 'not_registered' && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/60 text-foreground/80 border border-border/40">
                  {legalLabels[startup.legal_status]}
                  {startup.cin && <span className="ml-1.5 opacity-60">({startup.cin})</span>}
                </span>
              )}

              {!isOrgProject && startup.business_model && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/60 text-foreground/80 border border-border/40">
                  <Briefcase className="h-3.5 w-3.5 opacity-60" />
                  {businessModelLabels[startup.business_model] || startup.business_model}
                </span>
              )}

              {startup.team_size && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/60 text-foreground/80 border border-border/40">
                  <UsersRound className="h-3.5 w-3.5 opacity-60" />
                  {startup.team_size === '1' ? (isOrgProject ? 'Solo' : 'Solo Founder') : `${startup.team_size} members`}
                </span>
              )}

              {location && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/60 text-foreground/80 border border-border/40">
                  <MapPin className="h-3.5 w-3.5 opacity-60" />
                  {location}
                </span>
              )}

              {startup.founded_date && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/60 text-foreground/80 border border-border/40">
                  <Calendar className="h-3.5 w-3.5 opacity-60" />
                  Est. {new Date(startup.founded_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Elevator Pitch */}
        {startup.elevator_pitch && (
          <div className="mt-6 p-5 rounded-2xl bg-accent/20 border border-border/30 relative">
            <div className="flex items-center gap-2 mb-2 opacity-60">
              <Mic className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Elevator Pitch</span>
            </div>
            <p className="text-base text-foreground/90 font-medium leading-relaxed italic">&ldquo;{startup.elevator_pitch}&rdquo;</p>
          </div>
        )}

        {/* Owner view count */}
        {isOwner && startup.view_count !== undefined && (
          <div className="flex items-center gap-2 mt-5 text-xs font-medium text-muted-foreground/70">
            <Eye className="h-4 w-4" /> {startup.view_count.toLocaleString()} views
          </div>
        )}
        </div>
      </div>

      {/* ─── About & Positioning ─── */}
      {(startup.description || startup.categories?.length > 0 || startup.keywords?.length > 0 || hasPositioningData(startup)) && (
        <div className="bg-card border border-border/40 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Description */}
          {startup.description && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
                <Info className="h-4 w-4 text-primary" /> About
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">{startup.description}</p>
            </div>
          )}

          {/* Categories */}
          {startup.categories && startup.categories.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Sectors</h4>
              <div className="flex flex-wrap gap-2">
                {startup.categories.map((cat, i) => (
                  <span key={i} className="inline-flex items-center px-4 py-1.5 rounded-xl text-xs font-bold bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 transition-colors">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {startup.keywords && startup.keywords.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {startup.keywords.map((kw, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-xl text-xs bg-accent/50 text-foreground/70 font-semibold border border-border/40 transition-all hover:bg-accent hover:text-foreground">
                    <Hash className="inline h-3 w-3 mr-0.5 opacity-50" />
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Strengths & Target Audience — side by side on desktop */}
          {hasPositioningData(startup) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {startup.key_strengths && (
                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Key Strengths</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{startup.key_strengths}</p>
                </div>
              )}
              {startup.target_audience && (
                <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <Target className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Target Audience</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{startup.target_audience}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Founders ─── */}
      {startup.founders && startup.founders.filter(f => {
        if (f.status === 'declined') return false;
        if (f.status === 'pending' && !isOwner && !isCofounder) return false;
        return true;
      }).length > 0 && (
        <div className="bg-card border border-border/40 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="flex items-center gap-2.5 text-sm font-bold text-foreground mb-5">
            <UsersRound className="h-4.5 w-4.5 text-primary" /> {isOrgProject ? 'Team' : 'Founders'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {startup.founders.filter(f => {
              if (f.status === 'declined') return false;
              if (f.status === 'pending' && !isOwner && !isCofounder) return false;
              return true;
            }).map((f) => {
              const isAccepted = f.status === 'accepted';
              const isPending = f.status === 'pending';
              // Prefer real-time data from joined user, fallback to denormalized
              const username = f.user?.username || f.ments_username;
              const avatar = f.user?.avatar_url || f.avatar_url;

              const hasMents = !!username && isAccepted;
              const profileHref = hasMents ? `/profile/${username}` : null;

              const CardContent = (
                <div className={`flex items-center gap-4 p-4 bg-accent/15 rounded-2xl border border-border/20 group transition-all duration-200 h-full ${
                  hasMents ? 'hover:bg-accent/30 hover:border-primary/30 hover:shadow-md' : ''
                } ${isPending ? 'opacity-70' : ''}`}>
                  {avatar ? (
                    <img 
                      src={toProxyUrl(avatar, { width: 48, quality: 80 })} 
                      alt={f.name} 
                      className="h-12 w-12 rounded-xl object-cover flex-shrink-0 shadow-sm transition-transform group-hover:scale-105" 
                    />
                  ) : (
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                      isPending
                        ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-600'
                        : 'bg-gradient-to-br from-primary/20 to-primary/10 text-primary'
                    }`}>
                      {f.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold text-foreground truncate">{f.name}</p>
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          <Clock className="h-2.5 w-2.5" /> Pending
                        </span>
                      )}
                    </div>
                    {hasMents ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary/80 mt-0.5 group-hover:text-primary transition-colors">
                        @{username}
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    ) : f.role ? (
                      <span className="text-xs font-medium text-muted-foreground mt-0.5 block">{f.role}</span>
                    ) : null}
                  </div>
                </div>
              );

              return profileHref ? (
                <Link key={f.id} href={profileHref} className="block h-full">
                  {CardContent}
                </Link>
              ) : (
                <div key={f.id} className="h-full">
                  {CardContent}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Traction & Financials (startups only) ─── */}
      {!isOrgProject && hasFinancialData(startup) && (
        <div className="bg-card border border-border/40 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="flex items-center gap-2.5 text-sm font-bold text-foreground">
            <CircleDollarSign className="h-4.5 w-4.5 text-primary" /> Traction & Financials
          </h3>

          {/* Revenue & Funding summary stats */}
          {(startup.revenue_amount || startup.total_raised || startup.investor_count) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {startup.revenue_amount && (
                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-foreground tracking-tight">
                    {startup.revenue_currency && startup.revenue_currency !== 'USD' ? startup.revenue_currency + ' ' : startup.revenue_currency === 'USD' ? '$' : ''}
                    {startup.revenue_amount}
                  </p>
                  {startup.revenue_growth && (
                    <p className="text-xs text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> {startup.revenue_growth} MoM
                    </p>
                  )}
                </div>
              )}
              {startup.total_raised && (
                <div className="p-5 rounded-2xl bg-violet-500/5 border border-violet-500/10 shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Total Raised</p>
                  <p className="text-2xl font-bold text-foreground tracking-tight">{startup.total_raised}</p>
                </div>
              )}
              {startup.investor_count && (
                <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Investors</p>
                  <p className="text-2xl font-bold text-foreground tracking-tight">{startup.investor_count}</p>
                </div>
              )}
            </div>
          )}

          {/* Traction Metrics */}
          {startup.traction_metrics && (
            <div className="p-5 rounded-2xl bg-accent/20 border border-border/30">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Key Metrics</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap font-medium">{startup.traction_metrics}</p>
            </div>
          )}

          {/* Funding Rounds */}
          {startup.funding_rounds && startup.funding_rounds.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Funding Rounds</h4>
              <div className="space-y-3">
                {startup.funding_rounds.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4 bg-accent/15 rounded-2xl border border-border/20 hover:border-primary/20 transition-colors">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-foreground">{roundLabels[r.round_type || ''] || r.round_type || 'Round'}</p>
                      {r.investor && <p className="text-sm font-medium text-muted-foreground mt-0.5 truncate">{r.investor}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      {r.amount && <p className="text-base font-bold text-foreground">{r.amount}</p>}
                      {r.round_date && (
                        <p className="text-xs font-medium text-muted-foreground mt-0.5">
                          {new Date(r.round_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Pitch Video ─── */}
      {startup.pitch_video_url && (
        <div className="bg-card border border-border/40 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="flex items-center gap-2.5 text-sm font-bold text-foreground mb-4">
            <Video className="h-4.5 w-4.5 text-rose-500" /> Pitch Video
          </h3>
          <div className="rounded-2xl overflow-hidden border border-border/30 bg-black">
            <video
              src={startup.pitch_video_url}
              controls
              className="w-full max-h-80 object-contain"
            />
          </div>
        </div>
      )}

      {/* ─── Contact & Links ─── */}
      {hasContactDetails(startup) && (
        <div className="bg-card border border-border/40 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-5">Contact & Official Links</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {startup.startup_email && (
              <a href={`mailto:${startup.startup_email}`} className="flex items-center gap-4 p-4 rounded-2xl bg-accent/10 hover:bg-accent/25 transition-all group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/40 flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Mail className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Email</p>
                  <p className="text-sm font-semibold text-foreground truncate">{startup.startup_email}</p>
                </div>
              </a>
            )}
            {startup.startup_phone && (
              <a href={`tel:${startup.startup_phone}`} className="flex items-center gap-4 p-4 rounded-2xl bg-accent/10 hover:bg-accent/25 transition-all group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/40 flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Phone className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Phone</p>
                  <p className="text-sm font-semibold text-foreground truncate">{startup.startup_phone}</p>
                </div>
              </a>
            )}
            {startup.website && (
              <a href={startup.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-2xl bg-accent/10 hover:bg-accent/25 transition-all group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/40 flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Globe className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Website</p>
                  <p className="text-sm font-bold text-primary group-hover:underline truncate">{startup.website.replace(/^https?:\/\//, '')}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
            {startup.pitch_deck_url && (
              <a href={startup.pitch_deck_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 hover:bg-primary/10 transition-all group border border-primary/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-0.5">Presentation</p>
                  <p className="text-sm font-bold text-primary group-hover:underline">View Pitch Deck</p>
                </div>
                <ExternalLink className="h-4 w-4 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ─── Text Sections (showcase content) ─── */}
      {startup.text_sections && startup.text_sections.length > 0 && (
        <div className="bg-card border border-border/40 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8">
          {startup.text_sections
            .sort((a, b) => a.display_order - b.display_order)
            .map((section) => (
              <div key={section.id} className="group">
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {section.heading}
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">{section.content}</p>
              </div>
            ))}
        </div>
      )}

      {/* ─── Slides (showcase gallery) ─── */}
      {startup.slides && startup.slides.length > 0 && (
        <div className="bg-card border border-border/40 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="flex items-center gap-2.5 text-sm font-bold text-foreground mb-6">
            <Component className="h-4.5 w-4.5 text-primary" /> Project Gallery
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x" style={{ scrollbarWidth: 'none' }}>
            {startup.slides
              .sort((a, b) => a.slide_number - b.slide_number)
              .map((slide) => (
                <div key={slide.id} className="shrink-0 space-y-3 snap-start group" style={{ width: 300 }}>
                  <div className="w-full aspect-video rounded-2xl overflow-hidden border border-border/30 shadow-sm relative">
                    <img src={slide.slide_url} alt={slide.caption || `Slide ${slide.slide_number}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {slide.caption && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <p className="text-white text-xs font-medium leading-snug line-clamp-2">{slide.caption}</p>
                      </div>
                    )}
                  </div>
                  {!slide.caption && (
                    <div className="h-4" /> // Spacer if no caption to keep alignment
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ─── Links ─── */}
      {startup.links && startup.links.length > 0 && (
        <div className="bg-card border border-border/40 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="flex items-center gap-2.5 text-sm font-bold text-foreground mb-5">
            <Link2 className="h-4.5 w-4.5 text-primary" /> Important Links
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {startup.links
              .sort((a, b) => a.display_order - b.display_order)
              .map((link) => {
                const LinkIcon = getLinkIcon(link.url);
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-2xl bg-accent/10 hover:bg-accent/25 border border-border/40 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/40 flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                      <LinkIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm font-bold text-foreground group-hover:text-primary truncate flex-1 transition-colors">{link.title}</span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                  </a>
                );
              })}
          </div>
        </div>
      )}

      {/* ─── Recognition ─── */}
      {((startup.incubators && startup.incubators.length > 0) || (startup.awards && startup.awards.length > 0)) && (
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-5">
          {/* Incubators */}
          {startup.incubators && startup.incubators.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Building className="h-4 w-4 text-muted-foreground" /> Incubators & Programs
              </h3>
              <div className="flex flex-wrap gap-2">
                {startup.incubators.map((inc) => (
                  <span key={inc.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-accent/40 text-foreground/80 font-medium border border-border/20">
                    <Building className="h-3 w-3 text-muted-foreground" />
                    {inc.program_name}
                    {inc.year && <span className="text-muted-foreground">({typeof inc.year === 'string' ? new Date(inc.year).getFullYear() : inc.year})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Awards */}
          {startup.awards && startup.awards.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Award className="h-4 w-4 text-amber-500" /> Awards & Recognition
              </h3>
              <div className="flex flex-wrap gap-2">
                {startup.awards.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-500/8 text-amber-700 dark:text-amber-400 border border-amber-500/15 font-medium">
                    <Award className="h-3 w-3" />
                    {a.award_name}
                    {a.year && <span className="opacity-70">({typeof a.year === 'string' ? new Date(a.year).getFullYear() : a.year})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
