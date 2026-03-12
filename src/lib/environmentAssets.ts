type EnvironmentAsset = {
  icon: string;
  banner: string;
};

const ENVIRONMENT_ASSETS: Record<string, EnvironmentAsset> = {
  // ── New environments (12) ───────────────────────────────────────────────
  general: {
    icon: '/environments/icon_random_new.png',
    banner: '/environments/banner_random_3d_1771963291465.png',
  },
  ideation: {
    icon: '/environments/icon_idea_validation_new.png',
    banner: '/environments/banner_collaboration_3d_1771963611543.png',
  },
  mvp: {
    icon: '/environments/icon_app_dev_new.png',
    banner: '/environments/banner_app_dev_3d_1771963520343.png',
  },
  scaling: {
    icon: '/environments/icon_scaling_new.png',
    banner: '/environments/banner_scaling_3d_1771963416940.png',
  },
  marketing: {
    icon: '/environments/icon_memes_new.png',
    banner: '/environments/banner_memes_3d_1771963576850.png',
  },
  investing: {
    icon: '/environments/icon_politics_new.png',
    banner: '/environments/banner_politics_3d_1771963483961.png',
  },
  builders: {
    icon: '/environments/icon_data_science_new.png',
    banner: '/environments/banner_data_science_3d_1771963378111.png',
  },
  campus: {
    icon: '/environments/icon_collaboration_new.png',
    banner: '/environments/banner_collaboration_3d_1771963611543.png',
  },
  opportunities: {
    icon: '/environments/icon_scaling_new.png',
    banner: '/environments/banner_scaling_3d_1771963416940.png',
  },
  ai_and_tech: {
    icon: '/environments/icon_ai_new.png',
    banner: '/environments/banner_ai_3d_1771963396345.png',
  },
  resources: {
    icon: '/environments/icon_data_science_new.png',
    banner: '/environments/banner_random_3d_1771963291465.png',
  },
  hot_takes: {
    icon: '/environments/icon_politics_new.png',
    banner: '/environments/banner_politics_3d_1771963483961.png',
  },
};

function normalizeEnvironmentKey(name?: string | null): string | null {
  if (!name) return null;
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, '_');

  const aliases: Array<[string, string]> = [
    ['ai_and_tech', 'ai_and_tech'],
    ['hot_takes', 'hot_takes'],
  ];

  for (const [pattern, key] of aliases) {
    if (normalized.includes(pattern)) return key;
  }

  return ENVIRONMENT_ASSETS[normalized] ? normalized : null;
}

export function getEnvironmentAssetUrls(name?: string | null): EnvironmentAsset | null {
  const key = normalizeEnvironmentKey(name);
  return key ? ENVIRONMENT_ASSETS[key] : null;
}

export function resolveEnvironmentPicture(name?: string | null, picture?: string | null): string | null {
  return picture || getEnvironmentAssetUrls(name)?.icon || null;
}

export function resolveEnvironmentBanner(name?: string | null, banner?: string | null): string | null {
  return banner || getEnvironmentAssetUrls(name)?.banner || null;
}
