"use client";

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toProxyUrl } from '@/utils/imageUtils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';

export default function FollowersPage({ params }: { params: Promise<{ username?: string }> }) {
  const resolved = use(params);
  const username = (resolved?.username || '').trim();
  const router = useRouter();

  if (!username) notFound();

  type Row = {
    id: string;
    username: string;
    full_name?: string | null;
    avatar_url?: string | null;
    is_verified?: boolean | null;
  };

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/followers`);
        if (!res.ok) throw new Error('Failed to load followers');
        const json = await res.json();
        if (!cancelled) setRows(Array.isArray(json?.data) ? json.data : []);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load followers';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const list = rows
    .slice()
    .sort((a, b) => (a.full_name || a.username).localeCompare(b.full_name || b.username));

  const title = `Followers`;

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">
              {title}
            </h1>
            <div className="ml-auto text-sm text-muted-foreground">@{username}</div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm">
              {error}
            </div>
          ) : list.length === 0 ? (
            <div className="text-muted-foreground text-sm">No followers yet.</div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card/60">
              {list.map((u) => {
                const img = u.avatar_url
                  ? toProxyUrl(u.avatar_url, { width: 48, quality: 82 })
                  : undefined;
                const initials = (u.full_name || u.username)
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase();
                return (
                  <li key={u.id} className="p-3 sm:p-4">
                    <Link href={`/profile/${encodeURIComponent(u.username)}`} className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12" src={img} alt={u.username} fallback={<span className="text-foreground font-semibold">{initials}</span>} />
                        {u.is_verified && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5" aria-label="Verified">
                            <svg viewBox="0 0 40 40" width="20" height="20" className="block" aria-hidden="true">
                              <path d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Zm7.415 11.225 2.254 2.287-11.43 11.5-6.835-6.93 2.244-2.258 4.587 4.581 9.18-9.18Z" fill="#0095F6" fillRule="evenodd" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-foreground font-medium truncate">{u.full_name || u.username}</div>
                        </div>
                        <div className="text-muted-foreground text-sm truncate">@{u.username}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
