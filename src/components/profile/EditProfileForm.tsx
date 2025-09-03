"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { compressImage } from '@/utils/imageCompression';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';
import { Loader2, Camera, ArrowLeft, User, AtSign, MessageSquare, FileText } from 'lucide-react';
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
  about: string | null;
};

export default function EditProfileForm() {
  const { user, isLoading } = useAuth();
  const [initial, setInitial] = useState<ProfileShape | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const avatarFileRef = useRef<File | null>(null);
  const coverFileRef = useRef<File | null>(null);

  const isLocalUrl = (u?: string | null) => !!u && (/^blob:/i.test(u) || /^data:/i.test(u));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const asPublic = (u?: string | null) => {
    if (!u) return null;
    if (/^https?:\/\//i.test(u) || /^s3:\/\//i.test(u) || isLocalUrl(u)) return u;
    // treat as storage object path
    return `${supabaseUrl}/storage/v1/object/public/${u.replace(/^\//, '')}`;
  };

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
    } catch (e) {
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
        .select('id, username, full_name, avatar_url, banner_image, tagline, about')
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
        setBio(data.about || '');
        setAvatarPreview(asPublic(data.avatar_url) || null);
        setCoverPreview(asPublic(data.banner_image) || null);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const dirty = useMemo(() => {
    if (!initial) return true;
    return (
      fullName !== (initial.full_name || '') ||
      username !== (initial.username || '') ||
      tagline !== (initial.tagline || '') ||
      bio !== (initial.about || '') ||
      avatarFileRef.current !== null ||
      coverFileRef.current !== null
    );
  }, [initial, fullName, username, tagline, bio]);

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
        about: bio.trim(),
      } as any;
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
        .select('id, username, full_name, avatar_url, banner_image, tagline, about')
        .eq('id', user.id)
        .maybeSingle();
      if (latest) {
        setInitial(latest as ProfileShape);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
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
