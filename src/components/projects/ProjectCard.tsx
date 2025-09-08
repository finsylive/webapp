"use client";

import Link from "next/link";
import Image from "next/image";
import { Calendar, Rocket } from "lucide-react";
import { useMemo, useState } from "react";
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

function ensureProtocol(url?: string | null) {
  if (!url) return null;
  const t = url.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function ProjectCard({ item, username, categoryName }: { item: ProjectItem; username: string; categoryName?: string }) {
  const viewHref = `/profile/${encodeURIComponent(username)}/projects/${encodeURIComponent(item.id)}`;
  // Prefer explicit cover and logo as per API
  const coverUrl = useMemo(
    () => item.cover_url || item.image_url || item.thumbnail || item.thumbnail_url || null,
    [item.cover_url, item.image_url, item.thumbnail, item.thumbnail_url]
  );
  const logoUrl = useMemo(
    () => item.logo_url || item.thumbnail || item.thumbnail_url || item.image_url || null,
    [item.logo_url, item.thumbnail, item.thumbnail_url, item.image_url]
  );
  const [imageError, setImageError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const href = ensureProtocol(item.url);
  const dateStr = useMemo(() => {
    if (!item.created_at) return "";
    const d = new Date(item.created_at);
    try {
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }, [item.created_at]);
  const visibility = (item.visibility || "public").toLowerCase();

  return (
    <li className="group relative rounded-2xl border border-emerald-500/25 bg-card/60 overflow-hidden hover:border-emerald-400/40 transition-colors">
      <Link href={viewHref} className="absolute inset-0" aria-label="Open project" />
      {/* Media */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-b from-emerald-900/20 to-transparent">
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
          <div className="absolute inset-0 flex items-center justify-center text-emerald-400">
            <Rocket className="h-10 w-10 opacity-80" />
          </div>
        )}

        {/* Circular logo overlay */}
        {logoUrl && !logoError ? (
          <div className="absolute left-4 bottom-4 h-14 w-14 sm:h-16 sm:w-16 rounded-full overflow-hidden ring-2 ring-emerald-400/40 shadow-md bg-black/20">
            <Image
              src={toProxyUrl(logoUrl)}
              alt={(item.title || item.name || "project logo")?.toString()}
              fill
              sizes="64px"
              className="object-cover"
              priority={false}
              onError={() => setLogoError(true)}
            />
          </div>
        ) : (
          <div className="absolute left-4 bottom-4 h-14 w-14 sm:h-16 sm:w-16 rounded-full ring-2 ring-emerald-400/40 shadow-md bg-black/30 flex items-center justify-center">
            <Rocket className="h-7 w-7 text-emerald-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          {(categoryName || item.category) ? (
            <span className="text-[11px] rounded-full border border-emerald-500/40 text-emerald-300 px-2 py-0.5">
              {categoryName || item.category}
            </span>
          ) : null}
          {item.status ? (
            <span className="text-[11px] rounded-full border border-emerald-500/40 text-emerald-300 px-2 py-0.5">
              {item.status}
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 text-lg font-semibold leading-tight">
          {item.title || item.name || "Untitled"}
        </h3>
        {(item.tagline || item.description) && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {item.tagline || item.description}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{dateStr}</span>
          </div>
          <span
            className={`text-xs rounded-full px-2 py-0.5 border ${
              visibility === "public"
                ? "border-emerald-500/40 text-emerald-300"
                : visibility === "private"
                ? "border-yellow-500/40 text-yellow-300"
                : "border-blue-500/40 text-blue-300"
            }`}
          >
            {visibility}
          </span>
        </div>

        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="relative mt-3 inline-block text-sm text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Visit
          </a>
        )}
      </div>
    </li>
  );
}

export function ProjectCardSkeleton() {
  return (
    <li className="rounded-2xl border border-emerald-500/20 bg-card/60 overflow-hidden animate-pulse">
      <div className="aspect-[16/9] w-full bg-white/5" />
      <div className="p-5 space-y-2">
        <div className="h-5 w-2/3 bg-white/10 rounded" />
        <div className="h-4 w-full bg-white/10 rounded" />
        <div className="h-4 w-5/6 bg-white/10 rounded" />
        <div className="h-4 w-1/2 bg-white/10 rounded mt-4" />
      </div>
    </li>
  );
}
