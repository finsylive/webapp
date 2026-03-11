"use client";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { listProjects } from '@/api/projects';
import { ProjectCard, ProjectCardSkeleton, type ProjectItem } from '@/components/projects/ProjectCard';
import { useUserData } from '@/hooks/useUserData';

export default function UserProjectsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);

  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userData } = useUserData();
  const isOwner = userData?.username?.toLowerCase() === username?.toLowerCase();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await listProjects(username);
        if (!cancelled) {
          setItems((resp as { data: ProjectItem[] })?.data ?? []);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load projects';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (username) run();
    return () => { cancelled = true; };
  }, [username]);

  return (
    <DashboardLayout>
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto w-full">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href={`/profile/${encodeURIComponent(username)}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5 mr-1" /> Back
              </Link>
              <h1 className="text-2xl font-semibold">Projects</h1>
            </div>
            {isOwner && (
              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <Plus className="h-4 w-4" /> New Project
              </Link>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </ul>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground mb-4">No projects yet.</p>
              {isOwner && (
                <Link
                  href="/profile/edit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  <Plus className="h-4 w-4" /> Create your first project
                </Link>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {items.map((p) => (
                <ProjectCard key={p.id} item={p} username={username} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
