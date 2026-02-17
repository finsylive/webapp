"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

type ClearbitCompany = {
  name: string;
  domain: string;
  logo: string;
};

type CompanySelection = {
  name: string;
  domain: string;
};

type Props = {
  value: string;
  domain?: string;
  onChange: (sel: CompanySelection) => void;
  placeholder?: string;
  className?: string;
};

export default function CompanyAutocomplete({
  value,
  domain,
  onChange,
  placeholder = "Company Name",
  className = "",
}: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<ClearbitCompany[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync query when value changes externally (only if different to avoid loops)
  useEffect(() => {
    setQuery((prev) => (prev !== value ? value : prev));
  }, [value]);

  // Close dropdown on outside click
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
          `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`
        );
        if (!res.ok) return;
        const data: ClearbitCompany[] = await res.json();
        setSuggestions(data.slice(0, 6));
        setShowDropdown(data.length > 0);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleSelect = (company: ClearbitCompany) => {
    setQuery(company.name);
    onChange({ name: company.name, domain: company.domain });
    setShowDropdown(false);
    setSuggestions([]);
  };

  const syncToParent = () => {
    const trimmed = query.trim();
    if (trimmed) {
      onChange({ name: trimmed, domain: domain || "" });
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
            onChange({ name: val, domain: domain || "" });
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            // Small delay to allow dropdown click to register first
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
          {suggestions.map((c) => (
            <button
              key={c.domain}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-500/10 transition-colors flex items-center gap-3"
            >
              {c.logo ? (
                <img
                  src={c.logo}
                  alt=""
                  className="h-6 w-6 rounded object-contain bg-white"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Building2 className="h-5 w-5 text-emerald-500 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.domain}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
