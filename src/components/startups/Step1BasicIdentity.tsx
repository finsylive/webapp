"use client";

import { Building2 } from 'lucide-react';

type Step1Props = {
  data: {
    brand_name: string;
    registered_name: string;
    legal_status: string;
    cin: string;
  };
  onChange: (field: string, value: string) => void;
};

const legalStatuses = [
  { value: 'not_registered', label: 'Not Registered', desc: 'Pre-incorporation' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship', desc: 'Individual ownership' },
  { value: 'llp', label: 'LLP', desc: 'Limited Liability Partnership' },
  { value: 'pvt_ltd', label: 'Pvt Ltd', desc: 'Private Limited Company' },
];

export function Step1BasicIdentity({ data, onChange }: Step1Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Basic Identity</h2>
          <p className="text-sm text-muted-foreground">Start with your startup&apos;s core info</p>
        </div>
      </div>

      {/* Brand Name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Brand Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.brand_name}
          onChange={(e) => onChange('brand_name', e.target.value)}
          placeholder="e.g. Acme Technologies"
          className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Registered Name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Registered Name
        </label>
        <input
          type="text"
          value={data.registered_name}
          onChange={(e) => onChange('registered_name', e.target.value)}
          placeholder="e.g. Acme Technologies Pvt. Ltd."
          className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Legal Status */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Legal Status <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {legalStatuses.map((ls) => (
            <button
              key={ls.value}
              type="button"
              onClick={() => onChange('legal_status', ls.value)}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-200 ${data.legal_status === ls.value
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/30 hover:bg-accent/30'
                }`}
            >
              <span className="text-sm font-medium text-foreground">{ls.label}</span>
              <span className="text-xs text-muted-foreground">{ls.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CIN */}
      {(data.legal_status === 'llp' || data.legal_status === 'pvt_ltd') && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            CIN / LLPIN
          </label>
          <input
            type="text"
            value={data.cin}
            onChange={(e) => onChange('cin', e.target.value)}
            placeholder="e.g. U72200KA2020PTC123456"
            className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      )}
    </div>
  );
}
