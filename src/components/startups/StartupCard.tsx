"use client";

import Link from 'next/link';
import { StartupProfile } from '@/api/startups';
import { Rocket, TrendingUp, Globe, Users } from 'lucide-react';

const stageLabels: Record<string, string> = {
  ideation: 'Ideation',
  mvp: 'MVP',
  scaling: 'Scaling',
  expansion: 'Expansion',
  maturity: 'Maturity',
};

const stageColors: Record<string, string> = {
  ideation: 'from-blue-500 to-cyan-500',
  mvp: 'from-purple-500 to-pink-500',
  scaling: 'from-green-500 to-emerald-500',
  expansion: 'from-orange-500 to-amber-500',
  maturity: 'from-red-500 to-rose-500',
};

export function StartupCard({ startup }: { startup: StartupProfile }) {
  return (
    <Link href={`/startups/${startup.id}`}>
      <div className="group backdrop-blur-xl bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-primary/30 cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${stageColors[startup.stage] || 'from-primary to-primary/80'} shadow-md`}>
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {startup.brand_name}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r ${stageColors[startup.stage] || 'from-primary to-primary/80'} text-white`}>
                {stageLabels[startup.stage] || startup.stage}
              </span>
            </div>
          </div>

          {startup.is_actively_raising && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 border border-green-500/20 animate-pulse">
              <TrendingUp className="h-3 w-3" />
              Raising
            </span>
          )}
        </div>

        {/* Description */}
        {startup.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {startup.description}
          </p>
        )}

        {/* Keywords */}
        {startup.keywords && startup.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {startup.keywords.slice(0, 4).map((kw, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-accent/60 text-accent-foreground">
                {kw}
              </span>
            ))}
            {startup.keywords.length > 4 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                +{startup.keywords.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          {startup.founders && startup.founders.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {startup.founders.length} founder{startup.founders.length > 1 ? 's' : ''}
            </span>
          )}
          {startup.website && (
            <span className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              Website
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
