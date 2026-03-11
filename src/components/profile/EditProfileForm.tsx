"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { compressImage } from '@/utils/imageCompression';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';
import { Loader2, Camera, ArrowLeft, User, AtSign, MessageSquare, FileText, Zap, X, Search, ChevronDown, ChevronUp, MapPin, BadgeCheck, ShieldCheck, Link2, Github, Globe, Youtube, Linkedin, Plus, ArrowUp, ArrowDown, Pencil, Trash2, Rocket, FolderOpen } from 'lucide-react';
import { DribbbleIcon, BehanceIcon, FigmaIcon, SubstackIcon, InstagramIcon } from '@/components/ui/SocialIcons';
import { toProxyUrl } from '@/utils/imageUtils';
import { ImageCropModal } from '@/components/ui/ImageCropModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PROJECT_CATEGORIES } from '@/lib/projectCategories';

const EDGE_FUNCTION_NAME = 'upload-profile-image';

type SocialLinks = {
  github?: string;
  linkedin?: string;
  instagram?: string;
  dribbble?: string;
  behance?: string;
  youtube?: string;
  figma?: string;
  website?: string;
  substack?: string;
};

type ProjectRow = {
  id: string;
  title: string;
  tagline: string | null;
  logo_url: string | null;
  visibility: string;
  sort_order: number;
};

type StartupRow = {
  id: string;
  brand_name: string;
  stage: string | null;
  logo_url: string | null;
  is_published: boolean;
};

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
  looking_for: string[] | null;
  linkedin: string | null;
  social_links: SocialLinks | null;
  show_projects: boolean;
  show_startups: boolean;
};

const SKILL_SUGGESTIONS: Record<string, string[]> = {
  'Development': [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Go', 'Rust', 'Ruby',
    'React', 'Next.js', 'Vue.js', 'Angular', 'Node.js', 'Express.js', 'Django', 'Flask',
    'React Native', 'Flutter', 'Swift', 'Kotlin',
    'HTML', 'CSS', 'Tailwind CSS', 'SASS',
    'PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Firebase', 'Supabase',
    'GraphQL', 'REST API', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
    'Git', 'CI/CD', 'Linux', 'Terraform', 'DevOps', 'Cybersecurity',
  ],
  'Design': [
    'UI/UX Design', 'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator',
    'Wireframing', 'Prototyping', 'User Research', 'Design Systems',
    'Graphic Design', 'Motion Design', 'Branding', 'Typography',
    '3D Design', 'Blender', 'After Effects',
  ],
  'Product': [
    'Product Management', 'Product Strategy', 'Roadmapping', 'User Stories',
    'Agile', 'Scrum', 'Kanban', 'JIRA', 'Product Analytics',
    'A/B Testing', 'Feature Prioritization', 'OKRs',
  ],
  'Marketing': [
    'Digital Marketing', 'SEO', 'SEM', 'Content Marketing', 'Social Media Marketing',
    'Email Marketing', 'Growth Hacking', 'Google Analytics', 'Copywriting',
    'Brand Strategy', 'Influencer Marketing', 'Performance Marketing',
    'Community Building', 'Public Relations',
  ],
  'Sales': [
    'Sales Strategy', 'Business Development', 'Account Management', 'CRM',
    'Lead Generation', 'Cold Outreach', 'Sales Operations', 'Negotiation',
    'Enterprise Sales', 'Inside Sales', 'Partnership Development',
  ],
  'Finance': [
    'Financial Modeling', 'Fundraising', 'Pitching', 'Venture Capital',
    'Accounting', 'Budgeting', 'Financial Analysis', 'Revenue Operations',
    'Cap Table Management', 'Due Diligence', 'Valuation',
  ],
  'Operations': [
    'Operations Management', 'Supply Chain', 'Logistics', 'Process Optimization',
    'Project Management', 'Vendor Management', 'Quality Assurance',
    'Inventory Management', 'Lean Operations', 'Compliance',
  ],
  'Data & AI': [
    'Machine Learning', 'Deep Learning', 'Data Science', 'Data Analysis',
    'NLP', 'Computer Vision', 'TensorFlow', 'PyTorch',
    'Data Engineering', 'ETL', 'Power BI', 'Tableau',
    'Statistics', 'SQL', 'Pandas',
    'LLMs', 'Prompt Engineering', 'AI/ML Ops',
  ],
  'Content': [
    'Content Creation', 'Technical Writing', 'Copywriting', 'Blogging',
    'Video Production', 'Video Editing', 'Podcasting', 'Photography',
    'Social Media Content', 'Storytelling', 'Scriptwriting',
  ],
  'People & HR': [
    'Recruiting', 'Talent Acquisition', 'People Operations', 'Culture Building',
    'Performance Management', 'Compensation & Benefits', 'Employee Engagement',
    'Onboarding', 'Diversity & Inclusion', 'Team Management',
  ],
  'Legal': [
    'Contract Negotiation', 'Intellectual Property', 'Corporate Law',
    'Privacy & GDPR', 'Employment Law', 'Regulatory Compliance',
    'Term Sheets', 'Incorporation', 'Licensing',
  ],
  'Other': [
    'Public Speaking', 'Leadership', 'Communication', 'Problem Solving',
    'Consulting', 'Market Research', 'Business Strategy',
    'Blockchain', 'Web3', 'Solidity', 'Smart Contracts',
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
      <p className="text-xs text-muted-foreground">Help others find you.</p>

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
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeCategory === cat
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
  const router = useRouter();
  const [initial, setInitial] = useState<ProfileShape | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [tagline, setTagline] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [linkedin, setLinkedin] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});

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
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [coverChanged, setCoverChanged] = useState(false);
  const avatarFileRef = useRef<File | null>(null);
  const coverFileRef = useRef<File | null>(null);
  const [cropModal, setCropModal] = useState<{ file: File; mode: 'avatar' | 'cover' } | null>(null);

  // Projects management
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<ProjectRow | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('');
  const [addProjectSaving, setAddProjectSaving] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);

  // Startups management
  const [startups, setStartups] = useState<StartupRow[]>([]);

  // Section visibility
  const [showProjects, setShowProjects] = useState(true);
  const [showStartups, setShowStartups] = useState(true);

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
      const raw = (data as EdgeResp)?.imageUrl || (data as EdgeResp)?.url;
      if (!raw) throw new Error('Edge upload did not return a URL');
      // Normalize malformed https://s3:// URLs the edge function sometimes returns
      return (raw as string).replace(/^https?:\/\/s3:\/\//i, 's3://');
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
      let { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, banner_image, tagline, current_city, about, skills, looking_for, linkedin, social_links, show_projects, show_startups')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        // Migration not applied yet — columns don't exist. Fall back to base select.
        if (error.message?.includes('show_projects') || error.message?.includes('show_startups') || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          const { data: baseData, error: baseError } = await supabase
            .from('users')
            .select('id, username, full_name, avatar_url, banner_image, tagline, current_city, about, skills, looking_for, linkedin, social_links')
            .eq('id', user.id)
            .maybeSingle();
          if (baseError) {
            if (!cancelled) setError(baseError.message);
            return;
          }
          data = baseData ? { ...baseData, show_projects: true, show_startups: true } : null;
          error = null;
        } else {
          if (!cancelled) setError(error.message);
          return;
        }
      }
      if (data && !cancelled) {
        setInitial(data as ProfileShape);
        setFullName(data.full_name || '');
        setUsername(data.username || '');
        setTagline(data.tagline || '');
        setCity(data.current_city || '');
        setBio(data.about || '');
        setSkills(Array.isArray(data.skills) ? data.skills : []);
        setLookingFor(Array.isArray(data.looking_for) ? data.looking_for : []);
        setLinkedin(data.linkedin || '');
        setSocialLinks((data.social_links as SocialLinks) || {});
        setShowProjects(data.show_projects !== false);
        setShowStartups(data.show_startups !== false);
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

        // Load projects
        const { data: projData } = await supabase
          .from('projects')
          .select('id, title, tagline, logo_url, visibility, sort_order')
          .eq('owner_id', user.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (!cancelled) setProjects((projData as ProjectRow[]) || []);

        // Load startups
        const { data: startupData } = await supabase
          .from('startup_profiles')
          .select('id, brand_name, stage, logo_url, is_published')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true });
        if (!cancelled) setStartups((startupData as StartupRow[]) || []);
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
    const initialSocial = (initial.social_links as SocialLinks) || {};
    const socialChanged = JSON.stringify(socialLinks) !== JSON.stringify(initialSocial);
    return (
      fullName !== (initial.full_name || '') ||
      username !== (initial.username || '') ||
      tagline !== (initial.tagline || '') ||
      city !== (initial.current_city || '') ||
      bio !== (initial.about || '') ||
      linkedin !== (initial.linkedin || '') ||
      skillsChanged ||
      socialChanged ||
      avatarChanged ||
      coverChanged ||
      showProjects !== (initial.show_projects !== false) ||
      showStartups !== (initial.show_startups !== false)
    );
  }, [initial, fullName, username, tagline, city, bio, linkedin, skills, socialLinks, avatarChanged, coverChanged, showProjects, showStartups]);

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
    pickFile('image/*', (file) => {
      setCropModal({ file, mode: 'avatar' });
    });
  };

  const onPickCover = () => {
    pickFile('image/*', (file) => {
      setCropModal({ file, mode: 'cover' });
    });
  };

  const onCropDone = useCallback((croppedFile: File) => {
    if (!cropModal) return;
    if (cropModal.mode === 'avatar') {
      avatarFileRef.current = croppedFile;
      setAvatarPreview(URL.createObjectURL(croppedFile));
      setAvatarChanged(true);
    } else {
      coverFileRef.current = croppedFile;
      setCoverPreview(URL.createObjectURL(croppedFile));
      setCoverChanged(true);
    }
    setCropModal(null);
  }, [cropModal]);

  const onCropCancel = useCallback(() => {
    setCropModal(null);
  }, []);

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

  const moveProject = async (index: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= projects.length) return;
    const updated = [...projects];
    const aOrder = updated[index].sort_order;
    const bOrder = updated[swapIdx].sort_order;
    // If both have the same sort_order, assign distinct values first
    const newA = bOrder !== aOrder ? bOrder : (direction === 'up' ? bOrder - 1 : bOrder + 1);
    const newB = aOrder !== bOrder ? aOrder : (direction === 'up' ? aOrder + 1 : aOrder - 1);
    updated[index] = { ...updated[index], sort_order: newA };
    updated[swapIdx] = { ...updated[swapIdx], sort_order: newB };
    // Swap positions in array
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    setProjects(updated);
    // Persist both rows
    await Promise.all([
      supabase.from('projects').update({ sort_order: updated[index].sort_order }).eq('id', updated[index].id).eq('owner_id', user!.id),
      supabase.from('projects').update({ sort_order: updated[swapIdx].sort_order }).eq('id', updated[swapIdx].id).eq('owner_id', user!.id),
    ]);
  };

  const deleteProjectById = async (id: string) => {
    if (!username || !user) return;
    setDeletingProjectId(id);
    const { error } = await supabase.from('projects').delete().eq('id', id).eq('owner_id', user.id);
    setDeletingProjectId(null);
    setConfirmDeleteProject(null);
    if (!error) setProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleAddProject = async () => {
    if (!newProjectTitle.trim() || !newProjectCategory || !username || !user) return;
    setAddProjectSaving(true);
    setAddProjectError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newProjectTitle.trim(), category: newProjectCategory, visibility: 'public' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create project');
      const newProject: ProjectRow = {
        id: json.data.id,
        title: json.data.title,
        tagline: json.data.tagline,
        logo_url: json.data.logo_url,
        visibility: json.data.visibility,
        sort_order: json.data.sort_order ?? projects.length,
      };
      // Redirect to the project edit page so user can fill in full details
      router.push(`/profile/${encodeURIComponent(username)}/projects/${newProject.id}/edit`);
    } catch (e: unknown) {
      setAddProjectError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setAddProjectSaving(false);
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

      // Clean social links — remove empty values
      const cleanedSocial: SocialLinks = {};
      for (const [k, v] of Object.entries(socialLinks)) {
        if (v && v.trim()) cleanedSocial[k as keyof SocialLinks] = v.trim();
      }

      const payload: Partial<ProfileShape> = {
        full_name: fullName.trim(),
        username: username.trim(),
        tagline: tagline.trim(),
        current_city: city.trim(),
        about: bio.trim(),
        skills,
        looking_for: lookingFor,
        linkedin: linkedin.trim() || null,
        social_links: Object.keys(cleanedSocial).length > 0 ? cleanedSocial : null,
        show_projects: showProjects,
        show_startups: showStartups,
      };
      if (newAvatarUrl !== undefined) payload.avatar_url = newAvatarUrl;
      if (newBannerUrl !== undefined) payload.banner_image = newBannerUrl;

      let { error: upError } = await supabase
        .from('users')
        .update(payload)
        .eq('id', user.id);

      if (upError) {
        // Columns not in DB yet — retry without visibility fields
        if (upError.message?.includes('show_projects') || upError.message?.includes('show_startups') || upError.message?.includes('does not exist')) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { show_projects: _sp, show_startups: _ss, ...payloadWithout } = payload;
          const { error: retryError } = await supabase.from('users').update(payloadWithout).eq('id', user.id);
          upError = retryError;
        }
      }
      if (upError) throw upError;

      // Reset local refs and change flags
      avatarFileRef.current = null;
      coverFileRef.current = null;
      setAvatarChanged(false);
      setCoverChanged(false);

      // Re-fetch to ensure state is accurate (with same fallback)
      const { data: latest, error: fetchErr } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, banner_image, tagline, current_city, about, skills, looking_for, linkedin, social_links, show_projects, show_startups')
        .eq('id', user.id)
        .maybeSingle();
      if (fetchErr?.message?.includes('does not exist') || fetchErr?.message?.includes('show_projects')) {
        const { data: baseLatest } = await supabase
          .from('users')
          .select('id, username, full_name, avatar_url, banner_image, tagline, current_city, about, skills, looking_for, linkedin, social_links')
          .eq('id', user.id)
          .maybeSingle();
        if (baseLatest) {
          setInitial({ ...baseLatest, show_projects: showProjects, show_startups: showStartups } as ProfileShape);
          // Refresh previews from the saved DB value (not the ephemeral blob URL)
          if (newAvatarUrl !== undefined) setAvatarPreview(asPublic(baseLatest.avatar_url) || null);
          if (newBannerUrl !== undefined) setCoverPreview(asPublic(baseLatest.banner_image) || null);
        }
      } else if (latest) {
        setInitial(latest as ProfileShape);
        // Refresh previews from the saved DB value
        if (newAvatarUrl !== undefined) setAvatarPreview(asPublic(latest.avatar_url) || null);
        if (newBannerUrl !== undefined) setCoverPreview(asPublic(latest.banner_image) || null);
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
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <h1 className="text-xl font-semibold">Edit Profile</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${profileCompletion.percent}%` }}
            />
          </div>
          <span className={`text-[11px] font-semibold whitespace-nowrap ${profileCompletion.percent === 100 ? 'text-emerald-500' : 'text-muted-foreground'
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
            <div className="h-full w-full bg-muted" />)
          }
          <button type="button" onClick={onPickCover} className="absolute top-4 right-4 inline-flex items-center justify-center h-12 w-12 rounded-full bg-black/60 text-white hover:bg-black/70 transition-colors">
            <Camera className="h-6 w-6" />
          </button>

          {/* Avatar positioned at bottom left */}
          <div className="absolute -bottom-8 left-6 h-20 w-20 rounded-full ring-4 ring-background overflow-hidden bg-muted z-10">
            {avatarPreview ? (
              <Image src={proxied(avatarPreview, 96, 90) || avatarPreview} alt="avatar" width={80} height={80} className="h-full w-full object-cover" unoptimized />
            ) : (
              <div className="h-full w-full bg-emerald-600" />
            )}
            <button type="button" onClick={onPickAvatar} className="absolute inset-0 w-full h-full rounded-full bg-black/40 hover:bg-black/60 transition-colors z-20 flex items-center justify-center">
              <Camera className="h-6 w-6 text-white" />
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
              placeholder="About you"
            />
          </div>

          {/* Skills */}
          <SkillsInput skills={skills} setSkills={setSkills} />

          {/* Looking For */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Looking for</label>
            <div className="flex flex-wrap gap-2">
              {['co-founder', 'talent', 'funding', 'mentorship', 'partnerships', 'beta_users'].map((option) => {
                const isSelected = lookingFor.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setLookingFor(prev =>
                        isSelected
                          ? prev.filter(o => o !== option)
                          : [...prev, option]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                        : 'bg-background border-border text-muted-foreground hover:border-emerald-500/30 hover:text-foreground'
                    }`}
                  >
                    {option.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Social / Portfolio Links */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <Link2 className="h-4 w-4" />
              <label className="text-sm font-medium">Social & Portfolio Links</label>
            </div>
            <div className="space-y-3">
              {([
                { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/you' },
                { key: 'github', label: 'GitHub', icon: Github, placeholder: 'https://github.com/you' },
                { key: 'instagram', label: 'Instagram', icon: InstagramIcon, placeholder: 'https://instagram.com/you' },
                { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://yoursite.com' },
                { key: 'dribbble', label: 'Dribbble', icon: DribbbleIcon, placeholder: 'https://dribbble.com/you' },
                { key: 'behance', label: 'Behance', icon: BehanceIcon, placeholder: 'https://behance.net/you' },
                { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@you' },
                { key: 'figma', label: 'Figma', icon: FigmaIcon, placeholder: 'https://figma.com/@you' },
                { key: 'substack', label: 'Substack', icon: SubstackIcon, placeholder: 'https://you.substack.com' },
              ] as const).map(({ key, label, icon: Icon, placeholder }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted/50 flex-shrink-0">
                    <Icon className="h-4 w-4 text-foreground/60" />
                  </div>
                  <input
                    value={key === 'linkedin' ? linkedin : (socialLinks[key] || '')}
                    onChange={(e) => {
                      if (key === 'linkedin') {
                        setLinkedin(e.target.value);
                      } else {
                        setSocialLinks(prev => ({ ...prev, [key]: e.target.value }));
                      }
                    }}
                    className="flex-1 px-4 py-2.5 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Projects Section */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <FolderOpen className="h-4 w-4" />
            <span className="text-sm font-medium">Projects</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() => setShowProjects(p => !p)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={showProjects ? 'Hide from profile' : 'Show on profile'}
            >
              <span className="hidden sm:inline">{showProjects ? 'Visible' : 'Hidden'}</span>
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showProjects ? 'bg-emerald-500' : 'bg-muted border border-border'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showProjects ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setAddingProject(true); setNewProjectTitle(''); setNewProjectCategory(''); setAddProjectError(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Project
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {projects.length === 0 && !addingProject && (
            <div className="px-6 py-8 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No projects yet. Add your first one.</p>
            </div>
          )}

          {projects.map((project, index) => (
            <div key={project.id} className="flex items-center gap-3 px-4 py-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveProject(index, 'up')}
                  disabled={index === 0}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveProject(index, 'down')}
                  disabled={index === projects.length - 1}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              {/* Logo */}
              <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {project.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <FolderOpen className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{project.title}</p>
                {project.tagline && (
                  <p className="text-xs text-muted-foreground truncate">{project.tagline}</p>
                )}
              </div>

              {/* Visibility badge */}
              {project.visibility !== 'public' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground bg-muted/40 flex-shrink-0">
                  {project.visibility}
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link
                  href={`/profile/${encodeURIComponent(username)}/projects/${project.id}/edit`}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="Edit project"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteProject(project)}
                  disabled={deletingProjectId === project.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                  title="Delete project"
                >
                  {deletingProjectId === project.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {/* Add project inline form */}
          {addingProject && (
            <div className="px-4 py-3 space-y-3">
              <input
                type="text"
                autoFocus
                value={newProjectTitle}
                onChange={e => setNewProjectTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddProject(); if (e.key === 'Escape') setAddingProject(false); }}
                className="w-full px-3 py-2.5 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                placeholder="Project title"
              />
              <select
                value={newProjectCategory}
                onChange={e => setNewProjectCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
              >
                <option value="">Select category...</option>
                {PROJECT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {addProjectError && (
                <p className="text-xs text-red-400">{addProjectError}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddProject}
                  disabled={!newProjectTitle.trim() || !newProjectCategory || addProjectSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addProjectSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingProject(false); setAddProjectError(null); }}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete project confirmation modal */}
      {confirmDeleteProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => !deletingProjectId && setConfirmDeleteProject(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete project?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <strong>{confirmDeleteProject.title}</strong> and all its slides, sections, and links will be permanently deleted.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteProject(null)}
                disabled={!!deletingProjectId}
                className="px-4 py-2 rounded-lg text-sm hover:bg-muted/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteProjectById(confirmDeleteProject.id)}
                disabled={!!deletingProjectId}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 transition-colors"
              >
                {deletingProjectId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Startups Section */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <Rocket className="h-4 w-4" />
            <span className="text-sm font-medium">Startups</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() => setShowStartups(p => !p)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={showStartups ? 'Hide from profile' : 'Show on profile'}
            >
              <span className="hidden sm:inline">{showStartups ? 'Visible' : 'Hidden'}</span>
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showStartups ? 'bg-emerald-500' : 'bg-muted border border-border'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showStartups ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </span>
            </button>
            <Link
              href="/startups/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Startup
            </Link>
          </div>
        </div>

        <div className="divide-y divide-border">
          {startups.length === 0 && (
            <div className="px-6 py-8 text-center">
              <Rocket className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No startups yet.</p>
            </div>
          )}

          {startups.map(startup => (
            <div key={startup.id} className="flex items-center gap-3 px-4 py-3">
              {/* Logo */}
              <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {startup.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={startup.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Rocket className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{startup.brand_name}</p>
                {startup.stage && (
                  <p className="text-xs text-muted-foreground capitalize">{startup.stage.replace(/_/g, ' ')}</p>
                )}
              </div>

              {/* Status */}
              <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${
                startup.is_published
                  ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                  : 'border-border text-muted-foreground bg-muted/40'
              }`}>
                {startup.is_published ? 'published' : 'draft'}
              </span>

              {/* Edit */}
              <Link
                href={`/startups/${startup.id}/edit`}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors flex-shrink-0"
                title="Edit startup"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
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

      {cropModal && (
        <ImageCropModal
          file={cropModal.file}
          mode={cropModal.mode}
          onDone={onCropDone}
          onCancel={onCropCancel}
        />
      )}
    </div>
  );
}
