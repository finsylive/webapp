'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
// import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { PostList } from '@/components/posts/PostList';
import Image from 'next/image';
import { ChevronLeft, Info, Heart, Share2, Plus, Calendar, FileText, Clock, List as ListIcon, ChevronDown } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toProxyUrl } from '@/utils/imageUtils';

// Minimal type for environment
type Environment = {
  id: string;
  name: string;
  description?: string | null;
  picture?: string | null;
  created_at?: string | null;
};

export default function EnvironmentPage() {
  const router = useRouter();
  const params = useParams();
  const environmentId = String(params?.environmentId || '');

  const [env, setEnv] = useState<Environment | null>(null);
  const [stats, setStats] = useState<{ posts: number; likes: number }>({ posts: 0, likes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'latest' | 'most_liked' | 'all'>('latest');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  // Use reliable native select to avoid click interception issues
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [envImgError, setEnvImgError] = useState(false);
  const handleShare = (): void => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = env?.name || 'Environment';
    const text = env?.description || '';
    type WebShareNavigator = Navigator & { share?: (data: ShareData) => Promise<void> };
    const nav = navigator as WebShareNavigator;
    if (nav.share) {
      nav.share({ title, text, url }).catch(() => {});
      return;
    }
    if (navigator.clipboard && 'writeText' in navigator.clipboard) {
      void navigator.clipboard.writeText(url).catch(() => {});
    }
  };
  const handleNewPost = () => {
    router.push(`/create?env=${environmentId}`);
  };

  // Whenever sort changes, refresh posts (for now backend sorts by latest, others are placeholders)
  useEffect(() => {
    setRefreshTrigger((v) => v + 1);
  }, [sort]);

  useEffect(() => {
    let mounted = true;

    async function loadEnvironment() {
      if (!environmentId) return;
      setLoading(true);
      setError(null);
      try {
        // Fetch environment details
        const { data: envData, error: envError } = await supabase
          .from('environments')
          .select('id, name, description, picture, created_at')
          .eq('id', environmentId)
          .single();

        if (envError) throw envError;

        // Count top-level posts in this environment
        const { count: postsCount, error: postsErr } = await supabase
          .from('posts')
          .select('*, author:author_id!inner(account_status)', { count: 'exact', head: true })
          .eq('deleted', false)
          .is('parent_post_id', null)
          .eq('environment_id', environmentId)
          .eq('author.account_status', 'active');

        if (postsErr) throw postsErr;

        // Get post IDs to count likes
        const { data: postIds, error: postsIdsErr } = await supabase
          .from('posts')
          .select('id, author:author_id!inner(account_status)')
          .eq('deleted', false)
          .is('parent_post_id', null)
          .eq('environment_id', environmentId)
          .eq('author.account_status', 'active')
          .limit(1000); // basic cap

        if (postsIdsErr) throw postsIdsErr;

        let likesCount = 0;
        if (postIds && postIds.length > 0) {
          const ids = postIds.map((p: { id: string }) => p.id);
          const { data: likesRows, error: likesErr } = await supabase
            .from('post_likes')
            .select('post_id')
            .in('post_id', ids);
          if (likesErr) throw likesErr;
          likesCount = (likesRows?.length ?? 0);
        }

        if (mounted) {
          setEnv(envData as Environment);
          setStats({ posts: postsCount || 0, likes: likesCount });
        }
      } catch (e: unknown) {
        if (mounted) {
          const msg = e instanceof Error ? e.message : 'Failed to load environment';
          setError(msg);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadEnvironment();
    return () => {
      mounted = false;
    };
  }, [environmentId]);

  // Close modal with Escape
  useEffect(() => {
    if (!isInfoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsInfoOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isInfoOpen]);

  // No custom menu listeners needed with native select

  const headerBg = useMemo(() => ({
    background: 'linear-gradient(180deg, rgba(0,255,162,0.20) 0%, rgba(0,0,0,0.00) 100%)',
  }), []);

  if (!environmentId) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="post-card text-center">Missing environment id</div>
      </div>
    );
  }

  return (
    <DashboardLayout showSidebar>
    <div className="min-h-[calc(100vh-64px)]">
      {/* Top banner (constrained and rounded) */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="relative w-full h-36 md:h-40 rounded-2xl border border-white/10 overflow-hidden" style={headerBg}>
          <div className="absolute inset-0 z-20 flex items-start justify-between p-3 pointer-events-auto">
            <button
              className="inline-flex items-center gap-2 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 border border-white/10"
              onClick={() => router.back()}
            >
              <ChevronLeft className="w-5 h-5" /> Back
            </button>
            <button
              className="inline-flex items-center justify-center text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-9 h-9 border border-white/10"
              onClick={() => setIsInfoOpen(true)}
              aria-label="Environment info"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
          {/* Center emblem */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center overflow-hidden">
              {env?.picture && !envImgError ? (
                <Image
                  src={toProxyUrl(env.picture, { width: 64, quality: 82 })}
                  alt={env?.name || 'Environment'}
                  width={64}
                  height={64}
                  className="object-cover w-14 h-14 md:w-16 md:h-16 rounded-full"
                  onError={() => setEnvImgError(true)}
                  sizes="64px"
                  loading="lazy"
                />
              ) : (
                <span className="text-xl md:text-2xl">🌐</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Header content */}
      <div className="max-w-2xl mx-auto px-4 -mt-10 md:-mt-12">
        <div className="post-card p-5 md:p-6 relative overflow-visible">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-6 w-40 bg-muted/30 rounded" />
              <div className="h-4 w-72 bg-muted/20 rounded" />
            </div>
          ) : error ? (
            <div className="text-destructive">{error}</div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary/30 bg-muted/20 flex items-center justify-center">
                  {env?.picture && !envImgError ? (
                    <Image
                      src={toProxyUrl(env.picture, { width: 40, quality: 82 })}
                      alt={env?.name || 'Environment'}
                      width={40}
                      height={40}
                      className="object-cover w-10 h-10"
                      onError={() => setEnvImgError(true)}
                      sizes="40px"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-lg">🌐</span>
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">{env?.name || 'Environment'}</h1>
                  {env?.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed">{env.description}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground mb-1">Posts</div>
                  <div className="text-lg font-semibold">{stats.posts}</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-primary" /> Likes
                  </div>
                  <div className="text-lg font-semibold">{stats.likes}</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/60 p-3 hidden sm:block">
                  <div className="text-xs text-muted-foreground mb-1">Visibility</div>
                  <div className="text-lg font-semibold">Public</div>
                </div>
              </div>

              {/* Controls */}
              <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
                <h2 className="text-base font-semibold">Posts</h2>
                <div className="relative" ref={sortMenuRef}>
                  <label className="sr-only" htmlFor="env-sort">Sort posts</label>
                  <div className="relative">
                    <select
                      id="env-sort"
                      className="appearance-none bg-muted/20 hover:bg-muted/30 border border-border/50 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                      value={sort}
                      onChange={(e) => setSort(e.target.value as 'latest' | 'most_liked' | 'all')}
                      title="Sort posts"
                    >
                      <option value="latest">Latest</option>
                      <option value="most_liked">Most Liked</option>
                      <option value="all">All Posts</option>
                    </select>
                    {/* leading icon */}
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {sort === 'latest' && <Clock className="w-4 h-4" />}
                      {sort === 'most_liked' && <Heart className="w-4 h-4" />}
                      {sort === 'all' && <ListIcon className="w-4 h-4" />}
                    </span>
                    {/* chevron */}
                    <ChevronDown className="pointer-events-none w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Posts list */}
      <div className="max-w-2xl mx-auto px-4 mt-6 pb-10">
        <PostList environmentId={environmentId} refreshTrigger={refreshTrigger} />
        {/* Note: Currently, backend fetch is ordered by latest. "Most Liked" and "All" are placeholders for future enhancements. */}
      </div>
      
      {/* Info Modal */}
      {isInfoOpen && (
        <div
          className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsInfoOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-popover text-popover-foreground shadow-xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-primary/30 bg-muted/20 flex items-center justify-center">
                  {env?.picture && !envImgError ? (
                    <Image
                      src={toProxyUrl(env.picture, { width: 48, quality: 82 })}
                      alt={env?.name || 'Environment'}
                      width={48}
                      height={48}
                      className="object-cover w-12 h-12"
                      onError={() => setEnvImgError(true)}
                      sizes="48px"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xl">🌐</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{env?.name || 'Environment'}</h3>
                  {env?.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{env.description}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-border/50 bg-card/60 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <FileText className="w-4 h-4" />
                    <span>Total Posts</span>
                  </div>
                  <div className="text-foreground font-semibold">{stats.posts}</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/60 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Heart className="w-4 h-4 text-primary" />
                    <span>Total Likes</span>
                  </div>
                  <div className="text-foreground font-semibold">{stats.likes}</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/60 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>Created</span>
                  </div>
                  <div className="text-foreground font-semibold">
                    {env?.created_at ? new Date(env.created_at).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-primary hover:bg-primary/10 transition-colors"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90 transition-colors"
                  onClick={handleNewPost}
                >
                  <Plus className="w-4 h-4" /> New Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
