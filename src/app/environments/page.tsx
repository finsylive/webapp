"use client";

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import Image from 'next/image';
import { Users, Loader2 } from 'lucide-react';
import { toProxyUrl } from '@/utils/imageUtils';

interface Environment {
  id: string;
  name: string;
  picture: string | null;
  banner: string | null;
  description: string | null;
  created_at: string;
}

export default function EnvironmentsPage() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEnvironments() {
      try {
        const res = await fetch('/api/environments');
        if (!res.ok) throw new Error('Failed to fetch communities');
        const data = await res.json();
        setEnvironments(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }
    fetchEnvironments();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Communities</h1>
          <p className="text-sm text-muted-foreground mt-1">Browse and join communities to connect with like-minded builders</p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Loading communities...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-red-500 mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : environments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">No communities yet</p>
            <p className="text-sm text-muted-foreground">Communities will appear here once created.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {environments.map((env) => (
              <Link
                key={env.id}
                href={`/environments/${env.id}`}
                className="group rounded-2xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200"
              >
                {/* Banner */}
                <div className="relative h-24 sm:h-28 w-full bg-gradient-to-br from-emerald-600/20 via-teal-500/20 to-cyan-500/20">
                  {env.banner ? (
                    <Image
                      src={toProxyUrl(env.banner, { width: 600, quality: 80 })}
                      alt={env.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  ) : env.picture ? (
                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                      <Image
                        src={toProxyUrl(env.picture, { width: 200, quality: 60 })}
                        alt=""
                        width={200}
                        height={200}
                        className="object-cover blur-sm"
                      />
                    </div>
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                </div>

                {/* Info */}
                <div className="p-4 -mt-8 relative">
                  <div className="flex items-end gap-3">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden ring-2 ring-background bg-card flex items-center justify-center shrink-0">
                      {env.picture ? (
                        <Image
                          src={toProxyUrl(env.picture, { width: 56, quality: 80 })}
                          alt={env.name}
                          width={56}
                          height={56}
                          className="w-14 h-14 object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {env.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-0.5">
                      <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {env.name}
                      </h3>
                    </div>
                  </div>

                  {env.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                      {env.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
