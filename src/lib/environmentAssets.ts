type EnvironmentAsset = {
  icon: string;
  banner: string;
};

const ENVIRONMENT_ASSETS: Record<string, EnvironmentAsset> = {
  ai: {
    icon: '/environments/icon_ai_3d_1771963326159.png',
    banner: '/environments/banner_ai_3d_1771963396345.png',
  },
  app_dev: {
    icon: '/environments/icon_app_dev_3d_1771963500571.png',
    banner: '/environments/banner_app_dev_3d_1771963520343.png',
  },
  collaboration: {
    icon: '/environments/icon_collaboration_3d_1771963595429.png',
    banner: '/environments/banner_collaboration_3d_1771963611543.png',
  },
  data_science: {
    icon: '/environments/icon_data_science_3d_1771963309009.png',
    banner: '/environments/banner_data_science_3d_1771963378111.png',
  },
  idea_validation: {
    icon: '/environments/icon_idea_validation_3d_1771963629188.png',
    banner: '/environments/banner_collaboration_3d_1771963611543.png',
  },
  memes: {
    icon: '/environments/icon_memes_3d_1771963541209.png',
    banner: '/environments/banner_memes_3d_1771963576850.png',
  },
  politics: {
    icon: '/environments/icon_politics_3d_1771963433819.png',
    banner: '/environments/banner_politics_3d_1771963483961.png',
  },
  random: {
    icon: '/environments/icon_random_3d_1771963217006.png',
    banner: '/environments/banner_random_3d_1771963291465.png',
  },
  scaling: {
    icon: '/environments/icon_scaling_3d_1771963345556.png',
    banner: '/environments/banner_scaling_3d_1771963416940.png',
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
    ['artificial_intelligence', 'ai'],
    ['ai_ml', 'ai'],
    ['ai_ml_ops', 'ai'],
    ['app_development', 'app_dev'],
    ['application_development', 'app_dev'],
    ['data_and_ai', 'data_science'],
    ['machine_learning', 'data_science'],
    ['startup_scaling', 'scaling'],
    ['validation', 'idea_validation'],
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
