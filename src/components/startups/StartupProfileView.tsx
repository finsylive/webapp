"use client";

import { StartupProfile } from '@/api/startups';
import {
  Rocket, Globe, Mail, Phone, FileText, TrendingUp, Users, Award,
  Building, Bookmark, BookmarkCheck, ExternalLink, Eye, MapPin,
  Calendar, Zap, Target, BarChart3,
  Briefcase, Hash, Lightbulb, Crown, Gem, ChevronRight, Mic, Clock,
  FolderKanban, Link2
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
  ideation: Lightbulb, mvp: Rocket, scaling: TrendingUp, expansion: Crown, maturity: Gem,
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
      {/* ─── Banner ─── */}
      {startup.banner_url && (
        <div className="w-full h-48 sm:h-56 rounded-2xl overflow-hidden border border-border/30">
          <img src={startup.banner_url} alt="Banner" className="w-full h-full object-cover" />
        </div>
      )}

      {/* ─── Hero Card ─── */}
      <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-5">
          {/* Logo or Stage Icon */}
          {startup.logo_url ? (
            <img
              src={startup.logo_url}
              alt={startup.brand_name}
              className={`h-16 w-16 rounded-2xl object-cover border border-border/40 shadow-sm flex-shrink-0 ${startup.banner_url ? '-mt-14 ring-4 ring-card' : ''}`}
            />
          ) : (
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${stageColors[startup.stage] || 'from-primary to-primary/80'} shadow-lg flex-shrink-0 ${startup.banner_url ? '-mt-14 ring-4 ring-card' : ''}`}>
              <StageIcon className="h-7 w-7 text-white" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{startup.brand_name}</h1>
                {startup.registered_name && (
                  <p className="text-sm text-muted-foreground mt-0.5">{startup.registered_name}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isOrgProject && startup.is_actively_raising && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <TrendingUp className="h-3 w-3" /> Raising
                  </span>
                )}
                {(isOwner || isCofounder) ? (
                  <Link
                    href={`/startups/${startup.id}/edit`}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Edit Profile
                  </Link>
                ) : (
                  <button
                    onClick={startup.is_bookmarked ? onUnbookmark : onBookmark}
                    className={`p-2 rounded-xl border transition-colors ${
                      startup.is_bookmarked
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border hover:bg-accent/50'
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
            <div className="flex items-center flex-wrap gap-2 mt-3">
              {isOrgProject && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <FolderKanban className="h-3 w-3" />
                  Org Project
                </span>
              )}

              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r ${stageColors[startup.stage] || 'from-primary to-primary/80'} text-white`}>
                <StageIcon className="h-3 w-3" />
                {stageLabels[startup.stage] || startup.stage}
              </span>

              {!isOrgProject && startup.legal_status && startup.legal_status !== 'not_registered' && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/40 text-foreground/70">
                  {legalLabels[startup.legal_status]}
                  {startup.cin && <span className="ml-1 text-muted-foreground">({startup.cin})</span>}
                </span>
              )}

              {!isOrgProject && startup.business_model && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/40 text-foreground/70">
                  <Briefcase className="h-3 w-3" />
                  {businessModelLabels[startup.business_model] || startup.business_model}
                </span>
              )}

              {startup.team_size && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/40 text-foreground/70">
                  <Users className="h-3 w-3" />
                  {startup.team_size === '1' ? (isOrgProject ? 'Solo' : 'Solo Founder') : `${startup.team_size} people`}
                </span>
              )}

              {location && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/40 text-foreground/70">
                  <MapPin className="h-3 w-3" />
                  {location}
                </span>
              )}

              {startup.founded_date && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/40 text-foreground/70">
                  <Calendar className="h-3 w-3" />
                  Est. {new Date(startup.founded_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Elevator Pitch */}
        {startup.elevator_pitch && (
          <div className="mt-5 p-4 rounded-xl bg-accent/15 border border-border/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Mic className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Elevator Pitch</span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{startup.elevator_pitch}</p>
          </div>
        )}

        {/* Owner view count */}
        {isOwner && startup.view_count !== undefined && (
          <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> {startup.view_count} view{startup.view_count !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ─── About & Positioning ─── */}
      {(startup.description || startup.categories?.length > 0 || startup.keywords?.length > 0 || hasPositioningData(startup)) && (
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-5">
          {/* Description */}
          {startup.description && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{startup.description}</p>
            </div>
          )}

          {/* Categories */}
          {startup.categories && startup.categories.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Industry</h4>
              <div className="flex flex-wrap gap-1.5">
                {startup.categories.map((cat, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-primary/8 text-primary border border-primary/15">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {startup.keywords && startup.keywords.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <Hash className="inline h-3 w-3 mr-0.5" />Keywords
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {startup.keywords.map((kw, i) => (
                  <span key={i} className="px-3 py-1 rounded-lg text-xs bg-accent/50 text-foreground/70 font-medium">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Key Strengths & Target Audience — side by side on desktop */}
          {hasPositioningData(startup) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {startup.key_strengths && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-foreground">Key Strengths</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{startup.key_strengths}</p>
                </div>
              )}
              {startup.target_audience && (
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-semibold text-foreground">Target Audience</span>
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
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
            <Users className="h-4 w-4 text-muted-foreground" /> {isOrgProject ? 'Team' : 'Founders'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {startup.founders.filter(f => {
              if (f.status === 'declined') return false;
              if (f.status === 'pending' && !isOwner && !isCofounder) return false;
              return true;
            }).map((f) => {
              const isAccepted = f.status === 'accepted';
              const isPending = f.status === 'pending';
              const hasMents = !!f.ments_username && isAccepted;
              const isEmailOnly = !f.user_id && isAccepted;
              const profileHref = hasMents ? `/profile/${f.ments_username}` : undefined;
              const Wrapper = profileHref ? 'a' : 'div';
              const wrapperProps = profileHref ? { href: profileHref } : {};

              return (
                <Wrapper
                  key={f.id}
                  {...wrapperProps}
                  className={`flex items-center gap-3 p-3.5 bg-accent/15 rounded-xl border border-border/20 ${
                    hasMents ? 'hover:bg-accent/25 hover:border-primary/15 transition-colors cursor-pointer' : ''
                  } ${isPending ? 'opacity-70' : ''}`}
                >
                  {f.avatar_url ? (
                    <img src={f.avatar_url} alt={f.name} className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isPending
                        ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-600'
                        : 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary'
                    }`}>
                      {f.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/15 flex-shrink-0">
                          <Clock className="h-2.5 w-2.5" /> Pending
                        </span>
                      )}
                      {isEmailOnly && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/50 text-muted-foreground border border-border/40 flex-shrink-0">
                          Invited
                        </span>
                      )}
                    </div>
                    {hasMents ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary mt-0.5">
                        @{f.ments_username}
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    ) : f.role ? (
                      <span className="text-xs text-muted-foreground mt-0.5 block">{f.role}</span>
                    ) : isPending && f.ments_username ? (
                      <span className="text-xs text-muted-foreground mt-0.5 block">@{f.ments_username}</span>
                    ) : null}
                  </div>
                </Wrapper>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Traction & Financials (startups only) ─── */}
      {!isOrgProject && hasFinancialData(startup) && (
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> Traction & Financials
          </h3>

          {/* Revenue & Funding summary stats */}
          {(startup.revenue_amount || startup.total_raised || startup.investor_count) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {startup.revenue_amount && (
                <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Monthly Revenue</p>
                  <p className="text-lg font-bold text-foreground">
                    {startup.revenue_currency && startup.revenue_currency !== 'USD' ? startup.revenue_currency + ' ' : startup.revenue_currency === 'USD' ? '$' : ''}
                    {startup.revenue_amount}
                  </p>
                  {startup.revenue_growth && (
                    <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> {startup.revenue_growth} MoM
                    </p>
                  )}
                </div>
              )}
              {startup.total_raised && (
                <div className="p-3.5 rounded-xl bg-violet-500/5 border border-violet-500/10">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Raised</p>
                  <p className="text-lg font-bold text-foreground">{startup.total_raised}</p>
                </div>
              )}
              {startup.investor_count && (
                <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Investors</p>
                  <p className="text-lg font-bold text-foreground">{startup.investor_count}</p>
                </div>
              )}
            </div>
          )}

          {/* Traction Metrics */}
          {startup.traction_metrics && (
            <div className="p-4 rounded-xl bg-accent/15 border border-border/20">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Traction</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{startup.traction_metrics}</p>
            </div>
          )}

          {/* Funding Rounds */}
          {startup.funding_rounds && startup.funding_rounds.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Funding Rounds</h4>
              <div className="space-y-2">
                {startup.funding_rounds.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3.5 bg-accent/15 rounded-xl border border-border/20">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{roundLabels[r.round_type || ''] || r.round_type || 'Round'}</p>
                      {r.investor && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.investor}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      {r.amount && <p className="text-sm font-bold text-foreground">{r.amount}</p>}
                      {r.round_date && (
                        <p className="text-[11px] text-muted-foreground">
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

      {/* ─── Contact & Links ─── */}
      {hasContactDetails(startup) && (
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">Contact & Links</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {startup.startup_email && (
              <a href={`mailto:${startup.startup_email}`} className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 hover:bg-accent/25 transition-colors group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/40 flex-shrink-0">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground truncate transition-colors">{startup.startup_email}</span>
              </a>
            )}
            {startup.startup_phone && (
              <a href={`tel:${startup.startup_phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 hover:bg-accent/25 transition-colors group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/40 flex-shrink-0">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground truncate transition-colors">{startup.startup_phone}</span>
              </a>
            )}
            {startup.website && (
              <a href={startup.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 hover:bg-accent/25 transition-colors group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/40 flex-shrink-0">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-primary group-hover:underline truncate flex-1">{startup.website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </a>
            )}
            {startup.pitch_deck_url && (
              <a href={startup.pitch_deck_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 hover:bg-accent/25 transition-colors group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm text-primary group-hover:underline flex-1">View Pitch Deck</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </a>
            )}
            {startup.address_line1 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/40 flex-shrink-0">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground truncate">
                  {[startup.address_line1, startup.address_line2].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Text Sections (showcase content) ─── */}
      {startup.text_sections && startup.text_sections.length > 0 && (
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-5">
          {startup.text_sections
            .sort((a, b) => a.display_order - b.display_order)
            .map((section) => (
              <div key={section.id}>
                <h3 className="text-sm font-semibold text-foreground mb-2">{section.heading}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{section.content}</p>
              </div>
            ))}
        </div>
      )}

      {/* ─── Slides (showcase gallery) ─── */}
      {startup.slides && startup.slides.length > 0 && (
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">Gallery</h3>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {startup.slides
              .sort((a, b) => a.slide_number - b.slide_number)
              .map((slide) => (
                <div key={slide.id} className="shrink-0 space-y-1.5" style={{ width: 240 }}>
                  <div className="w-full h-36 rounded-xl overflow-hidden border border-border/30">
                    <img src={slide.slide_url} alt={slide.caption || `Slide ${slide.slide_number}`} className="w-full h-full object-cover" />
                  </div>
                  {slide.caption && (
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{slide.caption}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ─── Links ─── */}
      {startup.links && startup.links.length > 0 && (
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
            <Link2 className="h-4 w-4 text-muted-foreground" /> Links
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {startup.links
              .sort((a, b) => a.display_order - b.display_order)
              .map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 hover:bg-accent/25 transition-colors group"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/40 flex-shrink-0">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-primary group-hover:underline truncate flex-1">{link.title}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                </a>
              ))}
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
