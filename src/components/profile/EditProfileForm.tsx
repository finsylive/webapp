"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { compressImage } from '@/utils/imageCompression';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';
import { Loader2, Camera, ArrowLeft, User, AtSign, MessageSquare, FileText, Zap, X, Search, ChevronDown, ChevronUp, MapPin, BadgeCheck, ShieldCheck } from 'lucide-react';
import { toProxyUrl } from '@/utils/imageUtils';
import Link from 'next/link';

const EDGE_FUNCTION_NAME = 'upload-profile-image';

type ProfileShape = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  banner_image: string | null;
  tagline: string | null;
  current_city: string | null;
  about: string | null;
  skills: string[] | null;
};

const SKILL_SUGGESTIONS: Record<string, string[]> = {
  'Development': [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Go', 'Rust', 'Ruby',
    'React', 'Next.js', 'Vue.js', 'Angular', 'Node.js', 'Express.js', 'Django', 'Flask',
    'React Native', 'Flutter', 'Swift', 'Kotlin',
    'HTML', 'CSS', 'Tailwind CSS', 'SASS',
    'PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Firebase', 'Supabase',
    'GraphQL', 'REST API', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
    'Git', 'CI/CD', 'Linux', 'Terraform',
  ],
  'Design': [
    'UI/UX Design', 'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator',
    'Wireframing', 'Prototyping', 'User Research', 'Design Systems',
    'Graphic Design', 'Motion Design', 'Branding', 'Typography',
    '3D Design', 'Blender', 'After Effects',
  ],
  'Business': [
    'Product Management', 'Project Management', 'Agile', 'Scrum',
    'Business Strategy', 'Financial Modeling', 'Market Research',
    'Sales', 'Business Development', 'Fundraising', 'Pitching',
    'Operations', 'Supply Chain', 'Consulting',
  ],
  'Marketing': [
    'Digital Marketing', 'SEO', 'SEM', 'Content Marketing', 'Social Media Marketing',
    'Email Marketing', 'Growth Hacking', 'Google Analytics', 'Copywriting',
    'Brand Strategy', 'Influencer Marketing', 'Performance Marketing',
    'Community Building', 'Public Relations',
  ],
  'Data & AI': [
    'Machine Learning', 'Deep Learning', 'Data Science', 'Data Analysis',
    'NLP', 'Computer Vision', 'TensorFlow', 'PyTorch',
    'Data Engineering', 'ETL', 'Power BI', 'Tableau',
    'Statistics', 'A/B Testing', 'SQL', 'Pandas',
    'LLMs', 'Prompt Engineering', 'AI/ML Ops',
  ],
  'Other': [
    'Technical Writing', 'Content Creation', 'Video Editing',
    'Public Speaking', 'Leadership', 'Team Management',
    'Problem Solving', 'Communication', 'Negotiation',
    'Blockchain', 'Web3', 'Solidity', 'Smart Contracts',
    'Cybersecurity', 'Penetration Testing', 'DevOps',
  ],
};

const ALL_SKILLS = Object.values(SKILL_SUGGESTIONS).flat();

function SkillsInput({ skills, setSkills }: { skills: string[]; setSkills: React.Dispatch<React.SetStateAction<string[]>> }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  const filtered = useMemo(() => {
    if (!input.trim()) return [];
    const q = input.toLowerCase();
    return ALL_SKILLS.filter(s =>
      s.toLowerCase().includes(q) && !skills.includes(s)
    ).slice(0, 8);
  }, [input, skills]);

  // Get skills for the active browse category
  const browseCategorySkills = useMemo(() => {
    if (!activeCategory) return [];
    return (SKILL_SUGGESTIONS[activeCategory] || []).filter(s => !skills.includes(s));
  }, [activeCategory, skills]);

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills(prev => [...prev, trimmed]);
    }
    setInput('');
    inputRef.current?.focus();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="flex items-center gap-2 text-emerald-400">
        <Zap className="h-4 w-4" />
        <label className="text-sm font-medium">Skills</label>
      </div>
      <p className="text-xs text-muted-foreground">Add skills to help match you with relevant jobs & gigs.</p>

      {/* Selected skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
            >
              {skill}
              <button
                type="button"
                onClick={() => setSkills(prev => prev.filter(s => s !== skill))}
                className="hover:text-red-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input with dropdown */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const value = input.trim().replace(/,$/, '');
                if (value) addSkill(value);
              }
              if (e.key === 'Escape') setShowSuggestions(false);
            }}
            className="w-full pl-10 pr-4 py-3 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            placeholder="Search skills or type your own..."
          />
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && filtered.length > 0 && input.trim() && (
          <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {filtered.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { addSkill(s); setShowSuggestions(false); }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
              >
                <Zap className="h-3 w-3 text-emerald-500 shrink-0" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Browse by category */}
      <div>
        <button
          type="button"
          onClick={() => setActiveCategory(prev => prev ? null : Object.keys(SKILL_SUGGESTIONS)[0])}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {activeCategory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Browse skill suggestions
        </button>

        {activeCategory && (
          <div className="mt-3 space-y-3">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(SKILL_SUGGESTIONS).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    activeCategory === cat
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30'
                      : 'text-muted-foreground bg-muted/40 border border-border hover:bg-muted/60'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Skills grid for active category */}
            {browseCategorySkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {browseCategorySkills.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSkill(s)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-foreground bg-muted/40 border border-border hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all"
                  >
                    <span>+</span> {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">All skills in this category already added.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CityInput({ city, setCity }: { city: string; setCity: React.Dispatch<React.SetStateAction<string>> }) {
  const [query, setQuery] = useState(city);
  const [suggestions, setSuggestions] = useState<{ display: string; place_id: number }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync query when city changes externally (e.g. on load)
  useEffect(() => { setQuery(city); }, [city]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchLocations = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5&featuretype=city`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (!res.ok) return;
        const data = await res.json();
        const results = (data as { display_name: string; place_id: number; address?: { city?: string; town?: string; village?: string; state?: string; country?: string } }[]).map((item) => {
          const addr = item.address;
          const parts = [
            addr?.city || addr?.town || addr?.village || '',
            addr?.state || '',
            addr?.country || '',
          ].filter(Boolean);
          return {
            display: parts.length > 0 ? parts.join(', ') : item.display_name.split(',').slice(0, 3).join(',').trim(),
            place_id: item.place_id,
          };
        });
        // Deduplicate by display name
        const seen = new Set<string>();
        const unique = results.filter(r => {
          if (seen.has(r.display)) return false;
          seen.add(r.display);
          return true;
        });
        setSuggestions(unique);
        setShowDropdown(unique.length > 0);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="flex items-center gap-2 text-emerald-400">
        <MapPin className="h-4 w-4" />
        <label className="text-sm font-medium">City</label>
      </div>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            searchLocations(e.target.value);
          }}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          className="w-full pl-10 pr-4 py-3 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          placeholder="Search for a city..."
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.place_id}
                type="button"
                onClick={() => {
                  setCity(s.display);
                  setQuery(s.display);
                  setShowDropdown(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
              >
                <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{s.display}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditProfileForm() {
  const { user, isLoading } = useAuth();
  const [initial, setInitial] = useState<ProfileShape | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [tagline, setTagline] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  // Education count for completion
  const [hasEducation, setHasEducation] = useState(false);

  // Verification state
  const [isVerified, setIsVerified] = useState(false);
  const [verifyStep, setVerifyStep] = useState<'idle' | 'sending' | 'input' | 'confirming'>('idle');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const avatarFileRef = useRef<File | null>(null);
  const coverFileRef = useRef<File | null>(null);

  const isLocalUrl = (u?: string | null) => !!u && (/^blob:/i.test(u) || /^data:/i.test(u));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const asPublic = useCallback((u?: string | null) => {
    if (!u) return null;
    if (/^https?:\/\//i.test(u) || /^s3:\/\//i.test(u) || isLocalUrl(u)) return u;
    // treat as storage object path
    return `${supabaseUrl}/storage/v1/object/public/${u.replace(/^\//, '')}`;
  }, [supabaseUrl]);

  // Try Edge Function first (same pattern as post media): base64 JSON via supabase.functions.invoke
  const uploadToEdge = async (blob: Blob, type: 'avatar' | 'cover'): Promise<string> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.id) throw new Error('No authenticated user');

    // Wrap blob as a File with a safe name
    const ext = (blob.type.split('/')[1] || 'jpg').toLowerCase();
    const safeBase = `${type}_${Date.now()}`;
    const safeName = `${safeBase}.${ext}`.replace(/[^A-Za-z0-9_.-]/g, '_');
    const file = new File([blob], safeName, { type: blob.type || 'image/jpeg' });

    // Convert to base64 data URL
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    type EdgeResp = { imageUrl?: string; url?: string; fileType?: string };
    const payload = {
      imageData: dataUrl,
      fileName: safeName,
      userId: authUser.id,
      fileType: file.type,
      isVideo: false,
      type,
    };

    const attempt = async () => {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: payload,
      });
      if (error) throw new Error(error.message || 'Edge upload failed');
      const url = (data as EdgeResp)?.imageUrl || (data as EdgeResp)?.url;
      if (!url) throw new Error('Edge upload did not return a URL');
      return url as string;
    };

    try {
      return await attempt();
    } catch {
      // brief retry once (e.g., transient)
      await new Promise(r => setTimeout(r, 300));
      return await attempt();
    }
  };

  const uploadWithFallback = async (blob: Blob, type: 'avatar' | 'cover') => {
    try {
      return await uploadToEdge(blob, type);
    } catch {
      // Fallback to storage if edge fails for any reason
      return await uploadToStorage(blob, type);
    }
  };
  const proxied = (u?: string | null, w?: number, q?: number) => {
    if (!u) return null;
    if (isLocalUrl(u)) return u;
    const pub = asPublic(u);
    if (!pub) return null;
    return toProxyUrl(pub, { width: w, quality: q });
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, banner_image, tagline, current_city, about, skills')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        if (!cancelled) setError(error.message);
        return;
      }
      if (data && !cancelled) {
        setInitial(data as ProfileShape);
        setFullName(data.full_name || '');
        setUsername(data.username || '');
        setTagline(data.tagline || '');
        setCity(data.current_city || '');
        setBio(data.about || '');
        setSkills(Array.isArray(data.skills) ? data.skills : []);
        setAvatarPreview(asPublic(data.avatar_url) || null);
        setCoverPreview(asPublic(data.banner_image) || null);
        // Check verification status
        const { data: verData } = await supabase
          .from('users')
          .select('is_verified')
          .eq('id', user.id)
          .maybeSingle();
        if (verData && !cancelled) {
          setIsVerified(!!verData.is_verified);
        }
        // Check education count
        const { count: edCount } = await supabase
          .from('education')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (!cancelled) {
          setHasEducation((edCount || 0) > 0);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id, asPublic]);

  const profileCompletion = useMemo(() => {
    const fields = [
      { label: 'Full Name', done: !!fullName.trim() },
      { label: 'Avatar', done: !!avatarPreview },
      { label: 'Cover Image', done: !!coverPreview },
      { label: 'Tagline', done: !!tagline.trim() },
      { label: 'Bio', done: !!bio.trim() },
      { label: 'City', done: !!city.trim() },
      { label: 'Skills', done: skills.length > 0 },
      { label: 'Education', done: hasEducation },
    ];
    const completed = fields.filter(f => f.done).length;
    const percent = Math.round((completed / fields.length) * 100);
    const missing = fields.filter(f => !f.done).map(f => f.label);
    return { percent, missing };
  }, [fullName, avatarPreview, coverPreview, tagline, bio, city, skills, hasEducation]);

  const dirty = useMemo(() => {
    if (!initial) return true;
    const initialSkills = Array.isArray(initial.skills) ? initial.skills : [];
    const skillsChanged = skills.length !== initialSkills.length || skills.some((s, i) => s !== initialSkills[i]);
    return (
      fullName !== (initial.full_name || '') ||
      username !== (initial.username || '') ||
      tagline !== (initial.tagline || '') ||
      city !== (initial.current_city || '') ||
      bio !== (initial.about || '') ||
      skillsChanged ||
      avatarFileRef.current !== null ||
      coverFileRef.current !== null
    );
  }, [initial, fullName, username, tagline, city, bio, skills]);

  const pickFile = (accept: string, cb: (file: File) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) cb(f);
    };
    input.click();
  };

  const onPickAvatar = () => {
    pickFile('image/*', async (file) => {
      avatarFileRef.current = file;
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    });
  };

  const onPickCover = () => {
    pickFile('image/*', async (file) => {
      coverFileRef.current = file;
      const url = URL.createObjectURL(file);
      setCoverPreview(url);
    });
  };

  const uploadToStorage = async (blob: Blob, type: 'avatar' | 'cover'): Promise<string> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.id) throw new Error('No authenticated user');

    // Generate unique filename
    const timestamp = Date.now();
    const extension = blob.type.split('/')[1] || 'jpg';
    const filename = `${authUser.id}_${type}_${timestamp}.${extension}`;
    const filePath = `${type}s/${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('media')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  // Verification handlers
  const handleSendVerification = async () => {
    setVerifyStep('sending');
    setVerifyError(null);
    try {
      const res = await fetch('/api/verify/send', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send code');
      setVerifyStep('input');
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : 'Failed to send');
      setVerifyStep('idle');
    }
  };

  const handleConfirmVerification = async () => {
    if (verifyCode.length !== 6) return;
    setVerifyStep('confirming');
    setVerifyError(null);
    try {
      const res = await fetch('/api/verify/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Verification failed');
      setIsVerified(true);
      setVerifyStep('idle');
      setVerifyCode('');
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : 'Verification failed');
      setVerifyStep('input');
    }
  };

  const handleSave = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    setError(null);

    try {
      let newAvatarUrl: string | null | undefined = undefined; // undefined -> unchanged
      let newBannerUrl: string | null | undefined = undefined;

      if (avatarFileRef.current) {
        const compressed = await compressImage(avatarFileRef.current, { maxWidth: 512, maxHeight: 512, quality: 0.85 });
        newAvatarUrl = await uploadWithFallback(compressed, 'avatar');
      }
      if (coverFileRef.current) {
        const compressed = await compressImage(coverFileRef.current, { maxWidth: 1600, maxHeight: 900, quality: 0.85 });
        newBannerUrl = await uploadWithFallback(compressed, 'cover');
      }

      const payload: Partial<ProfileShape> = {
        full_name: fullName.trim(),
        username: username.trim(),
        tagline: tagline.trim(),
        current_city: city.trim(),
        about: bio.trim(),
        skills,
      };
      if (newAvatarUrl !== undefined) payload.avatar_url = newAvatarUrl;
      if (newBannerUrl !== undefined) payload.banner_image = newBannerUrl;

      const { error: upError } = await supabase
        .from('users')
        .update(payload)
        .eq('id', user.id);

      if (upError) throw upError;

      // Reset local refs
      avatarFileRef.current = null;
      coverFileRef.current = null;

      // Optionally re-fetch to ensure state is accurate
      const { data: latest } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, banner_image, tagline, current_city, about, skills')
        .eq('id', user.id)
        .maybeSingle();
      if (latest) {
        setInitial(latest as ProfileShape);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={initial?.username ? `/profile/${encodeURIComponent(initial.username)}` : '/profile'}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1"/>Back</Button>
        </Link>
        <h1 className="text-xl font-semibold">Edit Profile</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${profileCompletion.percent}%` }}
            />
          </div>
          <span className={`text-[11px] font-semibold whitespace-nowrap ${
            profileCompletion.percent === 100 ? 'text-emerald-500' : 'text-muted-foreground'
          }`}>
            {profileCompletion.percent}%
          </span>
        </div>
      </div>

      {/* Verify Profile Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-500">Profile Verification</span>
          </div>
          {isVerified ? (
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <BadgeCheck className="h-5 w-5" />
              <span className="font-medium">Your profile is verified</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Verify your profile to get a verified badge and build trust.
              </p>
              {verifyError && (
                <p className="text-xs text-red-400">{verifyError}</p>
              )}
              {verifyStep === 'idle' && (
                <Button
                  onClick={handleSendVerification}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Get Verified
                </Button>
              )}
              {verifyStep === 'sending' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending verification code...
                </div>
              )}
              {(verifyStep === 'input' || verifyStep === 'confirming') && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to your email:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-32 px-3 py-2 text-center text-lg tracking-widest border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="000000"
                    />
                    <Button
                      onClick={handleConfirmVerification}
                      disabled={verifyCode.length !== 6 || verifyStep === 'confirming'}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {verifyStep === 'confirming' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendVerification}
                    disabled={resendCooldown > 0}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Images Section */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="relative h-48 w-full bg-muted">
          {coverPreview ? (
            <Image
              src={proxied(coverPreview, 1200, 85) || coverPreview}
              alt="cover"
              fill
              className="object-cover object-center"
              sizes="(max-width:768px) 100vw, 1200px"
              unoptimized
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-purple-400 to-pink-500" />)
          }
          <button type="button" onClick={onPickCover} className="absolute top-4 right-4 inline-flex items-center justify-center h-12 w-12 rounded-full bg-black/60 text-white hover:bg-black/70 transition-colors">
            <Camera className="h-6 w-6"/>
          </button>
          
          {/* Avatar positioned at bottom left */}
          <div className="absolute -bottom-8 left-6 h-20 w-20 rounded-full ring-4 ring-background overflow-hidden bg-muted z-10">
            {avatarPreview ? (
              <Image src={proxied(avatarPreview, 96, 90) || avatarPreview} alt="avatar" width={80} height={80} className="h-full w-full object-cover" unoptimized />
            ) : (
              <div className="h-full w-full bg-emerald-600" />
            )}
            <button type="button" onClick={onPickAvatar} className="absolute inset-0 w-full h-full rounded-full bg-black/40 hover:bg-black/60 transition-colors z-20 flex items-center justify-center">
              <Camera className="h-6 w-6 text-white"/>
            </button>
          </div>
        </div>
        
        {/* Profile Images Label */}
        <div className="px-6 pt-12 pb-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">Profile Images</span>
          </div>
        </div>
      </div>

      {/* Profile Information Section */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-emerald-400">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Profile Information</span>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Full Name */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <User className="h-4 w-4" />
              <label className="text-sm font-medium">Full Name</label>
            </div>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              placeholder="Ashish kushwaha"
            />
          </div>
          
          {/* Username */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <AtSign className="h-4 w-4" />
              <label className="text-sm font-medium">Username</label>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-medium">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="ashishweapons"
              />
            </div>
          </div>
          
          {/* Tagline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <MessageSquare className="h-4 w-4" />
              <label className="text-sm font-medium">Tagline</label>
            </div>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              placeholder="frontend"
            />
          </div>
          
          {/* City */}
          <CityInput city={city} setCity={setCity} />

          {/* About */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <FileText className="h-4 w-4" />
              <label className="text-sm font-medium">About</label>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none transition-colors"
              placeholder="Tell something about you"
            />
          </div>

          {/* Skills */}
          <SkillsInput skills={skills} setSkills={setSkills} />
        </div>
      </div>
      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleSave} 
          disabled={!dirty || saving} 
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
