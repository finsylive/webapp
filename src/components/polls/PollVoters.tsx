"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Users, X, ChevronDown, ChevronUp, Eye, BarChart3 } from 'lucide-react';
import { getPollVoters, getPollStats, type PollVoter } from '@/api/posts';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { toProxyUrl } from '@/utils/imageUtils';

type PollVotersProps = {
  pollId: string;
  isCreator: boolean;
  totalVotes: number;
};

type GroupedVoters = {
  [optionId: string]: {
    option_text: string;
    voters: PollVoter[];
    count: number;
  };
};

export function PollVoters({ pollId, isCreator, totalVotes }: PollVotersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [voters, setVoters] = useState<PollVoter[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'voters' | 'stats'>('voters');
  const { user } = useAuth();

  const loadVotersData = async () => {
    if (!user || !isCreator) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [votersResponse, statsResponse] = await Promise.all([
        getPollVoters(pollId, user.id),
        getPollStats(pollId, user.id)
      ]);
      
      if (votersResponse.error) {
        setError(votersResponse.error.message);
      } else {
        setVoters(votersResponse.voters);
      }
      
      if (statsResponse.error) {
        console.error('Stats error:', statsResponse.error.message);
      } else {
        setStats(statsResponse.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voters');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      loadVotersData();
    }
    setIsOpen(!isOpen);
  };

  if (!isCreator || totalVotes === 0) {
    return null;
  }

  // Group voters by option
  const groupedVoters: GroupedVoters = voters.reduce((acc, voter) => {
    if (!acc[voter.option_id]) {
      acc[voter.option_id] = {
        option_text: voter.option_text,
        voters: [],
        count: 0
      };
    }
    acc[voter.option_id].voters.push(voter);
    acc[voter.option_id].count++;
    return acc;
  }, {} as GroupedVoters);

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="text-xs text-muted-foreground hover:text-foreground gap-1 px-2 py-1 h-auto"
      >
        <Eye className="h-3 w-3" />
        View Voters ({totalVotes})
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {isOpen && (
        <div className="mt-3 border border-border rounded-lg bg-card/50 overflow-hidden">
          {/* Header with toggle */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
            <h3 className="font-medium text-sm">Poll Analytics</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('voters')}
                className={`px-2 py-1 text-xs rounded transition ${
                  viewMode === 'voters' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-3 w-3 inline mr-1" />
                Voters
              </button>
              <button
                onClick={() => setViewMode('stats')}
                className={`px-2 py-1 text-xs rounded transition ${
                  viewMode === 'stats' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart3 className="h-3 w-3 inline mr-1" />
                Stats
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground ml-2"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="p-3">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive py-2">{error}</div>
            )}

            {!loading && !error && viewMode === 'stats' && stats && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/30 rounded p-2 text-center">
                    <div className="font-semibold">{stats.totalVotes}</div>
                    <div className="text-xs text-muted-foreground">Total Votes</div>
                  </div>
                  <div className="bg-muted/30 rounded p-2 text-center">
                    <div className="font-semibold">{stats.uniqueVoters}</div>
                    <div className="text-xs text-muted-foreground">Unique Voters</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Option Breakdown</h4>
                  {stats.optionBreakdown.map((option: any, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 mr-2">{option.option_text}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{option.votes} votes</span>
                        <span className="font-medium min-w-[3rem] text-right">{option.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && viewMode === 'voters' && (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(groupedVoters).length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No votes yet
                  </div>
                ) : (
                  Object.entries(groupedVoters).map(([optionId, data]) => (
                    <div key={optionId} className="space-y-2">
                      <h4 className="text-sm font-medium text-primary">
                        {data.option_text} ({data.count})
                      </h4>
                      <div className="space-y-1 pl-2">
                        {data.voters.map((voter) => (
                          <div key={`${voter.user_id}-${voter.option_id}`} className="flex items-center gap-2 py-1">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                              {voter.user.avatar_url ? (
                                <Image
                                  src={toProxyUrl(voter.user.avatar_url, { width: 24, quality: 82 })}
                                  alt={voter.user.username}
                                  width={24}
                                  height={24}
                                  className="w-full h-full object-cover"
                                  sizes="24px"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="text-xs font-medium text-muted-foreground">
                                  {voter.user.username?.charAt(0).toUpperCase() || 'U'}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-medium truncate">
                                  {voter.user.full_name || voter.user.username}
                                </span>
                                {voter.user.is_verified && (
                                  <div className="w-3 h-3 bg-primary rounded-full flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                @{voter.user.username}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(voter.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}