export const PROJECT_CATEGORIES = [
  'Web App',
  'Mobile App',
  'AI / ML',
  'Open Source Tool',
  'Game',
  'Design',
  'Data / Analytics',
  'API / Dev Tool',
  'Browser Extension',
  'Hardware',
  'Other',
] as const;

export type ProjectCategory = typeof PROJECT_CATEGORIES[number];
