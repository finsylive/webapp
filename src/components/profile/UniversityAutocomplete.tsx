"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";

type HipolabsUniversity = {
  name: string;
  domains: string[];
  web_pages: string[];
  country: string;
};

type UniversitySelection = {
  name: string;
  domain: string;
  country: string;
};

type Props = {
  value: string;
  domain?: string;
  onChange: (sel: UniversitySelection) => void;
  placeholder?: string;
  className?: string;
};

export default function UniversityAutocomplete({
  value,
  domain,
  onChange,
  placeholder = "Institution Name",
  className = "",
}: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<HipolabsUniversity[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery((prev) => (prev !== value ? value : prev));
  }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `http://universities.hipolabs.com/search?name=${encodeURIComponent(q)}`
        );
        if (!res.ok) return;
        const data: HipolabsUniversity[] = await res.json();
        // Deduplicate by name
        const seen = new Set<string>();
        const unique = data.filter((u) => {
          if (seen.has(u.name)) return false;
          seen.add(u.name);
          return true;
        });
        setSuggestions(unique.slice(0, 6));
        setShowDropdown(unique.length > 0);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleSelect = (uni: HipolabsUniversity) => {
    setQuery(uni.name);
    onChange({
      name: uni.name,
      domain: uni.domains?.[0] || "",
      country: uni.country,
    });
    setShowDropdown(false);
    setSuggestions([]);
  };

  const syncToParent = () => {
    const trimmed = query.trim();
    if (trimmed) {
      onChange({ name: trimmed, domain: domain || "", country: "" });
    }
    setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            search(val);
            // Keep parent in sync as user types
            onChange({ name: val, domain: domain || "", country: "" });
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            setTimeout(() => syncToParent(), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              syncToParent();
            }
            if (e.key === "Escape") setShowDropdown(false);
          }}
          className="w-full px-4 py-3 rounded-xl bg-background/50 border border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder={placeholder}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((u, i) => {
            const faviconDomain = u.domains?.[0];
            return (
              <button
                key={`${u.name}-${i}`}
                type="button"
                onClick={() => handleSelect(u)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-500/10 transition-colors flex items-center gap-3"
              >
                {faviconDomain ? (
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=32`}
                    alt=""
                    className="h-5 w-5 rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <GraduationCap className="h-5 w-5 text-emerald-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.name}</div>
                  {u.country && (
                    <div className="text-xs text-muted-foreground truncate">{u.country}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
