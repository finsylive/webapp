"use client";

import { Plus, X, UserCircle, Mail } from 'lucide-react';
import { MentsUserSearch } from './MentsUserSearch';
import type { EntityType } from '@/api/startups';

type Founder = {
  name: string;
  role: string;
  email: string;
  user_id: string;
  ments_username: string;
  avatar_url: string;
  display_order: number;
};

type Step2Props = {
  data: {
    description: string;
  };
  founders: Founder[];
  onChange: (field: string, value: string) => void;
  onFoundersChange: (founders: Founder[]) => void;
  entityType?: EntityType;
};

const inputClass = "w-full px-4 py-2.5 bg-background border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-colors";

export function Step2Description({ data, founders, onChange, onFoundersChange, entityType }: Step2Props) {
  const isOrg = entityType === 'org_project';
  const addFounder = () => {
    onFoundersChange([...founders, { name: '', role: '', email: '', user_id: '', ments_username: '', avatar_url: '', display_order: founders.length }]);
  };

  const removeFounder = (index: number) => {
    if (founders.length > 1) {
      onFoundersChange(
        founders.filter((_, i) => i !== index).map((f, i) => ({ ...f, display_order: i }))
      );
    }
  };

  const updateFounder = (index: number, field: keyof Founder, value: string) => {
    const updated = [...founders];
    updated[index] = { ...updated[index], [field]: value };
    onFoundersChange(updated);
  };

  const linkMentsUser = (index: number, user: { user_id: string; ments_username: string; full_name: string; avatar_url: string | null }) => {
    const updated = [...founders];
    updated[index] = {
      ...updated[index],
      user_id: user.user_id,
      ments_username: user.ments_username,
      avatar_url: user.avatar_url || '',
      email: '', // clear email when linked to Ments profile
      name: updated[index].name.trim() || user.full_name,
    };
    onFoundersChange(updated);
  };

  const unlinkMentsUser = (index: number) => {
    const updated = [...founders];
    updated[index] = {
      ...updated[index],
      user_id: '',
      ments_username: '',
      avatar_url: '',
    };
    onFoundersChange(updated);
  };

  const charCount = data.description.length;
  const charLimit = 500;
  const isNearLimit = charCount > charLimit * 0.85;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground">Description & Team</h2>
        <p className="text-sm text-muted-foreground mt-1">Tell us what you&apos;re building and who&apos;s behind it</p>
      </div>

      {/* Product Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Product / Service Description <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <textarea
            value={data.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Describe what your startup does, the problem it solves, and what makes it unique..."
            rows={5}
            maxLength={charLimit}
            className={`${inputClass} resize-none`}
          />
          <div className="flex justify-end mt-1.5">
            <span className={`text-xs tabular-nums ${isNearLimit ? 'text-amber-500' : 'text-muted-foreground/50'}`}>
              {charCount}/{charLimit}
            </span>
          </div>
        </div>
      </div>

      {/* Founders */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          {isOrg ? 'Team Members' : 'Founders'} <span className="text-red-400">*</span>
        </label>
        <div className="space-y-3">
          {founders.map((founder, index) => (
            <div key={index} className="relative p-4 bg-accent/20 rounded-xl border border-border/30">
              <div className="flex items-center gap-2 mb-3">
                {founder.avatar_url ? (
                  <img src={founder.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserCircle className="h-3.5 w-3.5" />
                  </div>
                )}
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isOrg ? 'Member' : 'Founder'} {index + 1}
                  {founder.ments_username && (
                    <span className="normal-case tracking-normal font-medium text-primary ml-1.5">
                      @{founder.ments_username}
                    </span>
                  )}
                </span>
                {founders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFounder(index)}
                    className="ml-auto p-1 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={founder.name}
                  onChange={(e) => updateFounder(index, 'name', e.target.value)}
                  placeholder="Full name"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={founder.role}
                  onChange={(e) => updateFounder(index, 'role', e.target.value)}
                  placeholder={isOrg ? 'Role (e.g. Lead, Coordinator, Designer)' : 'Role (e.g. CEO, CTO, CPO)'}
                  className={inputClass}
                />
                <MentsUserSearch
                  linkedUser={
                    founder.user_id
                      ? { user_id: founder.user_id, ments_username: founder.ments_username, avatar_url: founder.avatar_url || undefined }
                      : null
                  }
                  onSelect={(user) => linkMentsUser(index, user)}
                  onUnlink={() => unlinkMentsUser(index)}
                  placeholder="Link their Ments profile..."
                />
                {/* Email — only shown when not linked to a Ments profile */}
                {!founder.user_id && (
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                    <input
                      type="email"
                      value={founder.email}
                      onChange={(e) => updateFounder(index, 'email', e.target.value)}
                      placeholder="Email (to send invite if not on Ments)"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addFounder}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground bg-accent/20 hover:bg-accent/40 hover:text-foreground border border-dashed border-border/50 hover:border-border transition-all"
        >
          <Plus className="h-4 w-4" />
          {isOrg ? 'Add Member' : 'Add Co-Founder'}
        </button>
      </div>
    </div>
  );
}
