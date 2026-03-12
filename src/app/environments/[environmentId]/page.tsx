'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { PostList } from '@/components/posts/PostList';
import Image from 'next/image';
import { ChevronLeft, Info, Heart, Share2, Plus, Calendar, FileText, Clock, List as ListIcon, ChevronDown, Globe, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toProxyUrl } from '@/utils/imageUtils';
import { resolveEnvironmentBanner, resolveEnvironmentPicture } from '@/lib/environmentAssets';

// Minimal type for environment
type Environment = {
  id: string;
  name: string;
  description?: string | null;
  picture?: string | null;
  banner?: string | null;
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
        const { data: envData, error: envError } = await supabase
          .from('environments')
          .select('id, name, description, picture, banner, created_at')
          .eq('id', environmentId)
          .single();

        if (envError) throw envError;

        const { count: postsCount, error: postsErr } = await supabase
          .from('posts')
          .select('*, author:author_id!inner(account_status)', { count: 'exact', head: true })
          .eq('deleted', false)
          .is('parent_post_id', null)
          .eq('environment_id', environmentId)
          .eq('author.account_status', 'active');

        if (postsErr) throw postsErr;

        const { data: postIds, error: postsIdsErr } = await supabase
          .from('posts')
          .select('id, author:author_id!inner(account_status)')
          .eq('deleted', false)
          .is('parent_post_id', null)
          .eq('environment_id', environmentId)
          .eq('author.account_status', 'active')
          .limit(1000);

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

  useEffect(() => {
    if (!isInfoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsInfoOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isInfoOpen]);

  const envPicture = useMemo(() => resolveEnvironmentPicture(env?.name, env?.picture), [env?.name, env?.picture]);
  const envBanner = useMemo(() => resolveEnvironmentBanner(env?.name, env?.banner), [env?.name, env?.banner]);

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
        <div className="px-2 sm:px-3">
          {/* ── Cover banner ── */}
          <div className="relative w-full h-40 sm:h-44 md:h-52 rounded-2xl overflow-hidden">
            {envBanner ? (
              <Image
                src={toProxyUrl(envBanner, { width: 1200, quality: 82 })}
                alt={env?.name || 'Environment banner'}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/30 via-emerald-900/20 to-transparent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />

            {/* Top bar */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3">
              <button
                className="inline-flex items-center gap-1.5 text-white/90 hover:text-white bg-black/25 hover:bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm transition-colors"
                onClick={() => router.back()}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                className="inline-flex items-center justify-center text-white/90 hover:text-white bg-black/25 hover:bg-black/40 backdrop-blur-sm rounded-full w-8 h-8 transition-colors"
                onClick={() => setIsInfoOpen(true)}
                aria-label="Environment info"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Info card ── */}
          <div className="relative mt-[7px] bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl px-4 sm:px-5 pt-3 pb-4">
            {/* Avatar overlapping boundary */}
            <div className="absolute -top-10 sm:-top-12 right-4 sm:right-5 z-10">
              <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-full overflow-hidden ring-4 ring-[hsl(var(--card))] bg-card shadow-lg flex items-center justify-center"
                style={{ width: 72, height: 72 }}
              >
                {envPicture && !envImgError ? (
                  <Image
                    src={toProxyUrl(envPicture, { width: 72, quality: 82 })}
                    alt={env?.name || 'Environment'}
                    width={72}
                    height={72}
                    className="object-cover w-full h-full"
                    onError={() => setEnvImgError(true)}
                    sizes="72px"
                    loading="lazy"
                  />
                ) : (
                  <Globe className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-3 pt-1">
                <div className="h-5 w-36 bg-muted/30 rounded" />
                <div className="h-3.5 w-64 bg-muted/20 rounded" />
                <div className="flex gap-4 mt-3">
                  <div className="h-3 w-16 bg-muted/20 rounded" />
                  <div className="h-3 w-16 bg-muted/20 rounded" />
                </div>
              </div>
            ) : error ? (
              <div className="text-destructive py-4">{error}</div>
            ) : (
              <>
                {/* Name & description */}
                <div className="pr-20 sm:pr-24">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground leading-tight">{env?.name || 'Environment'}</h1>
                  {env?.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{env.description}</p>
                  )}
                </div>

                {/* Inline stats + actions */}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-sm">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{stats.posts}</span>
                    <span className="text-muted-foreground">posts</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Heart className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-foreground">{stats.likes}</span>
                    <span className="text-muted-foreground">likes</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Public</span>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                      onClick={handleShare}
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      onClick={handleNewPost}
                    >
                      <Plus className="w-3.5 h-3.5" /> Post
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>

        {/* ── Sort controls ── */}
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between mt-5 mb-3 px-1">
            <h2 className="text-sm font-semibold text-foreground">Posts</h2>
            <div className="relative" ref={sortMenuRef}>
              <label className="sr-only" htmlFor="env-sort">Sort posts</label>
              <div className="relative">
                <select
                  id="env-sort"
                  className="appearance-none bg-accent/30 hover:bg-accent/50 border border-border/40 rounded-lg pl-8 pr-7 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-colors"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'latest' | 'most_liked' | 'all')}
                  title="Sort posts"
                >
                  <option value="latest">Latest</option>
                  <option value="most_liked">Most Liked</option>
                  <option value="all">All Posts</option>
                </select>
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {sort === 'latest' && <Clock className="w-3.5 h-3.5" />}
                  {sort === 'most_liked' && <Heart className="w-3.5 h-3.5" />}
                  {sort === 'all' && <ListIcon className="w-3.5 h-3.5" />}
                </span>
                <ChevronDown className="pointer-events-none w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Posts list */}
        <div className="max-w-2xl mx-auto px-4 pb-10">
          <PostList environmentId={environmentId} refreshTrigger={refreshTrigger} />
        </div>

        {/* ── Info Modal ── */}
        {isInfoOpen && (
          <div
            className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsInfoOpen(false);
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-popover text-popover-foreground shadow-xl overflow-hidden">
              {/* Modal banner */}
              <div className="relative h-24 w-full">
                {envBanner ? (
                  <Image
                    src={toProxyUrl(envBanner, { width: 600, quality: 82 })}
                    alt={env?.name || ''}
                    fill
                    className="object-cover"
                    sizes="400px"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/30 via-emerald-900/20 to-transparent" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--popover))]/80 to-transparent" />
              </div>

              <div className="px-5 pb-5 -mt-8 relative z-10">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full overflow-hidden ring-4 ring-[hsl(var(--popover))] bg-card flex items-center justify-center mb-3">
                  {envPicture && !envImgError ? (
                    <Image
                      src={toProxyUrl(envPicture, { width: 56, quality: 82 })}
                      alt={env?.name || 'Environment'}
                      width={56}
                      height={56}
                      className="object-cover w-14 h-14"
                      onError={() => setEnvImgError(true)}
                      sizes="56px"
                    />
                  ) : (
                    <Globe className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                <h3 className="text-lg font-bold">{env?.name || 'Environment'}</h3>
                {env?.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{env.description}</p>
                )}

                {/* Stats list */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-accent/30">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span>Posts</span>
                    </div>
                    <span className="text-sm font-semibold">{stats.posts}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-accent/30">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Heart className="w-4 h-4 text-primary" />
                      <span>Likes</span>
                    </div>
                    <span className="text-sm font-semibold">{stats.likes}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-accent/30">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Created</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {env?.created_at ? new Date(env.created_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2.5">
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    onClick={handleShare}
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
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
