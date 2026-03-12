"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { StartupProfile } from '@/api/startups';
import {
  Rocket, TrendingUp, Users, MapPin,
  BrainCircuit, DraftingCompass, Globe2, Medal, Zap,
  FolderKanban
} from 'lucide-react';
import { toProxyUrl } from '@/utils/imageUtils';

const stageLabels: Record<string, string> = {
  ideation: 'Ideation', mvp: 'MVP', scaling: 'Scaling', expansion: 'Expansion', maturity: 'Maturity',
};
const stageGradients: Record<string, string> = {
  ideation: 'from-blue-500 to-cyan-500',
  mvp: 'from-purple-500 to-pink-500',
  scaling: 'from-green-500 to-emerald-500',
  expansion: 'from-orange-500 to-amber-500',
  maturity: 'from-red-500 to-rose-500',
};
const stagePills: Record<string, string> = {
  ideation: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  mvp: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  scaling: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  expansion: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  maturity: 'bg-red-500/10 text-red-600 border-red-500/20',
};
const stageIcons: Record<string, typeof Rocket> = {
  ideation: BrainCircuit,
  mvp: DraftingCompass,
  scaling: Zap,
  expansion: Globe2,
  maturity: Medal,
};

function StartupLogo({ startup }: { startup: StartupProfile }) {
  const [proxySrc, setProxySrc] = useState<string | null>(
    startup.logo_url ? toProxyUrl(startup.logo_url, { width: 56, quality: 85 }) : null
  );
  const [proxyFailed, setProxyFailed] = useState(false);
  const [directFailed, setDirectFailed] = useState(false);

  const StageIcon = stageIcons[startup.stage] || Rocket;

  if (proxySrc && !directFailed) {
    return (
      <Image
        src={proxySrc}
        alt={startup.brand_name}
        width={56}
        height={56}
        className="h-14 w-14 rounded-2xl object-cover shadow-sm"
        unoptimized
        onError={() => {
          if (!proxyFailed) {
            // Fall back to direct URL
            if (startup.logo_url && /^https?:\/\//i.test(startup.logo_url)) {
              setProxySrc(startup.logo_url);
            } else {
              setDirectFailed(true);
            }
            if (proxyFailed) setProxyFailed(true);
          } else {
            setDirectFailed(true);
          }
        }}
      />
    );
  }

  // Gradient fallback
  return (
    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${stageGradients[startup.stage] || 'from-primary to-primary/80'} shadow-md flex-shrink-0`}>
      <StageIcon className="h-6 w-6 text-white" />
    </div>
  );
}

function buildLocation(startup: StartupProfile): string | null {
  const parts = [startup.city, startup.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

export function StartupCard({ startup }: { startup: StartupProfile }) {
  const location = buildLocation(startup);
  const StageIcon = stageIcons[startup.stage] || Rocket;
  const isOrgProject = startup.entity_type === 'org_project';
  const displayText = startup.elevator_pitch || startup.description;
  const tags = [
    ...(startup.categories?.slice(0, 2) || []),
    ...(startup.keywords?.slice(0, Math.max(0, 3 - (startup.categories?.slice(0, 2).length || 0))) || []),
  ];
  const extraCount = ((startup.categories?.length || 0) + (startup.keywords?.length || 0)) - tags.length;
  const acceptedFounders = startup.founders?.filter(f => !f.status || f.status === 'accepted') || [];

  return (
    <Link href={`/startups/${startup.id}`}>
      <div className="group bg-card border border-border/50 rounded-[2.5rem] overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 cursor-pointer flex flex-col h-full relative">
        
        {/* Subtle hover background glow */}
        <div className={`absolute inset-0 bg-gradient-to-br ${stageGradients[startup.stage]} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`} />

        <div className="p-5 flex-1 relative z-10">
          {/* Header: logo + name + raising */}
          <div className="flex items-start gap-4">
            <StartupLogo startup={startup} />

            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 text-base tracking-tight leading-tight">
                  {startup.brand_name}
                </h3>
              </div>

              {/* Stage + business model + location */}
              <div className="flex items-center flex-wrap gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${stagePills[startup.stage] || 'bg-primary/10 text-primary border-primary/20 shadow-sm'}`}>
                  <StageIcon className="h-3 w-3" />
                  {stageLabels[startup.stage] || startup.stage}
                </span>

                {isOrgProject && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm">
                    <FolderKanban className="h-3 w-3" /> Project
                  </span>
                )}

                {!isOrgProject && startup.is_actively_raising && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm">
                    <TrendingUp className="h-3 w-3" /> Raising
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {displayText && (
            <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2 mt-4 font-medium opacity-80 group-hover:opacity-100 transition-opacity">
              {displayText}
            </p>
          )}

          {/* Location & Tags */}
          <div className="mt-4 flex flex-col gap-3">
            {location && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/70">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </div>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.slice(0, 2).map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-accent/60 text-foreground/70 border border-border/30 group-hover:border-primary/20 transition-colors">
                    {tag}
                  </span>
                ))}
                {extraCount > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground/60 ml-1">+{extraCount} more</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer: founders */}
        {acceptedFounders.length > 0 && (
          <div className="px-5 py-3.5 border-t border-border/30 bg-accent/10 flex items-center justify-between mt-auto relative z-10 group-hover:bg-accent/20 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex -space-x-2">
                {acceptedFounders.slice(0, 3).map((f, i) => {
                  const avatar = f.user?.avatar_url || f.avatar_url;
                  return (
                    <div
                      key={f.id}
                      className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary shadow-sm"
                      style={{ zIndex: 3 - i }}
                      title={f.name}
                    >
                      {avatar ? (
                        <img src={toProxyUrl(avatar, { width: 32, quality: 75 })} alt={f.name} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        f.name.charAt(0).toUpperCase()
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="text-[11px] font-bold text-muted-foreground truncate group-hover:text-foreground transition-colors">
                {acceptedFounders[0].name.split(' ')[0]}
                {acceptedFounders.length > 1 && ` & ${acceptedFounders.length - 1} others`}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/50 border border-border/30 text-[10px] font-bold text-muted-foreground/60">
              <Users className="h-3 w-3" />
              {acceptedFounders.length}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
