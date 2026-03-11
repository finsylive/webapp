"use client";

import Link from "next/link";
import Image from "next/image";
import { Rocket } from "lucide-react";
import { useState } from "react";
import { toProxyUrl } from "@/utils/imageUtils";

export type ProjectItem = {
  id: string;
  title?: string | null;
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  status?: string | null;
  url?: string | null;
  created_at?: string | null;
  visibility?: string | null;
  image_url?: string | null;
  thumbnail?: string | null;
  thumbnail_url?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  category?: string | null;
};

export function ProjectCard({ item, username }: { item: ProjectItem; username: string; categoryName?: string }) {
  const viewHref = `/profile/${encodeURIComponent(username)}/projects/${encodeURIComponent(item.id)}`;
  const coverUrl = item.cover_url || item.image_url || item.thumbnail || item.thumbnail_url || null;
  const [imageError, setImageError] = useState(false);

  return (
    <li className="group relative rounded-2xl border border-border bg-card/60 overflow-hidden hover:border-emerald-400/40 transition-colors">
      <Link href={viewHref} className="absolute inset-0 z-10" aria-label="Open project" />
      {/* Cover */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/20">
        {coverUrl && !imageError ? (
          <Image
            src={toProxyUrl(coverUrl)}
            alt={(item.title || item.name || "project cover")?.toString()}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
            <Rocket className="h-10 w-10" />
          </div>
        )}
      </div>

      {/* Content — title + tagline only */}
      <div className="p-4">
        <h3 className="text-base font-semibold leading-tight truncate">
          {item.title || item.name || "Untitled"}
        </h3>
        {(item.tagline || item.description) && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {item.tagline || item.description}
          </p>
        )}
      </div>
    </li>
  );
}

export function ProjectCardSkeleton() {
  return (
    <li className="rounded-2xl border border-border bg-card/60 overflow-hidden animate-pulse">
      <div className="aspect-[16/9] w-full bg-muted/10" />
      <div className="p-4 space-y-2">
        <div className="h-5 w-2/3 bg-muted/10 rounded" />
        <div className="h-4 w-full bg-muted/10 rounded" />
      </div>
    </li>
  );
}
