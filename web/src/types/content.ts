import { z } from 'zod';

/** Shapes of all editable portfolio content. The API (Phase 5) returns this same shape. */

const textItem = z.object({ title: z.string(), detail: z.string().default('') });

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  short: z.string().default(''),
  kind: z.string().default(''),
  tagline: z.string().default(''),
  summary: z.string(),
  reel: z.string().default(''),
  features: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  github: z.string().default(''),
  live: z.string().default(''),
  demo: z.string().default(''),
  icon: z.string().default('rocket'),
  image: z.string().default(''),
  visible: z.boolean().default(true),
  home: z.boolean().default(true),
  /** Shown on the CV. */
  cv: z.boolean().default(true),
  /** The project's own CV bullets; empty means the CV's project style decides. */
  cvBullets: z.array(z.string()).default([]),
});

export const experienceSchema = z.object({
  id: z.string(),
  title: z.string(),
  org: z.string(),
  start: z.string(), // "YYYY-MM"
  end: z.string().nullable().optional(), // null = current role
  short: z.string().optional(),
  type: z.string().optional(),
  metrics: z.array(z.tuple([z.string(), z.string()])).default([]),
  bullets: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  milestone: z.boolean().default(false),
  /** Shown on the CV. */
  cv: z.boolean().default(true),
});

export const skillCategorySchema = z.object({
  name: z.string(),
  desc: z.string().default(''),
  items: z.array(z.string()),
});

export const serviceSchema = z.object({
  id: z.string(),
  visual: z.string().default('generic'),
  chip: z.string(),
  title: z.string(),
  desc: z.string(),
  proof: z.string().default(''),
  visible: z.boolean().default(true),
});

export const profileSchema = z.object({
  status: z.string(),
  hello: z.string(),
  headline: z.string(),
  rotating: z.array(z.string()),
  intro: z.string(),
  introRest: z.string(),
  email: z.string(),
  whatsapp: z.string(),
  phone: z.string(),
  linkedin: z.string(),
  github: z.string(),
  teamStat: z.string().default('3'),
});

export const cvSectionSchema = z.object({
  key: z.enum(['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'languages', 'volunteering']),
  title: z.string().default(''),
  visible: z.boolean().default(true),
});

/** CV settings. Empty fields fall back to the defaults in content/defaults.ts. */
export const cvSchema = z.object({
  headline: z.array(z.string()).default([]),
  summary: z.string().default(''),
  location: z.string().default(''),
  availability: z.string().default(''),
  showWebsite: z.boolean().default(true),
  projectStyle: z.enum(['summary', 'features', 'both']).catch('summary').default('summary'),
  sections: z.array(cvSectionSchema).default([]),
});

/** Editable text blocks of one page. Each page uses the blocks it needs. */
export const pageTextSchema = z.object({
  kicker: z.string().default(''),
  title: z.string().default(''),
  accent: z.string().default(''),
  intro: z.string().default(''),
  lead: z.string().default(''),
  paragraphs: z.array(z.string()).default([]),
  items: z.array(z.string()).default([]),
  steps: z.array(textItem).default([]),
});

export const pagesSchema = z.object({
  home: pageTextSchema.prefault({}),
  about: pageTextSchema.prefault({}),
  experience: pageTextSchema.prefault({}),
  projects: pageTextSchema.prefault({}),
  services: pageTextSchema.prefault({}),
  cv: pageTextSchema.prefault({}),
  footer: pageTextSchema.prefault({}),
});

export const siteContentSchema = z.object({
  version: z.number().default(1),
  updatedAt: z.string().nullable().optional(),
  profile: profileSchema,
  highlights: z.array(z.object({ n: z.string(), t: z.string() })),
  projects: z.array(projectSchema),
  experience: z.array(experienceSchema),
  clients: z.array(z.string()).default([]),
  skills: z.array(skillCategorySchema),
  services: z.array(serviceSchema),
  education: z.array(textItem).default([]),
  certifications: z.array(textItem).default([]),
  languages: z.array(textItem).default([]),
  volunteering: z.array(textItem).default([]),
  cv: cvSchema.prefault({}),
  pages: pagesSchema.prefault({}),
});

export type SiteContent = z.infer<typeof siteContentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type Service = z.infer<typeof serviceSchema>;
export type CvSettings = z.infer<typeof cvSchema>;
export type CvSection = z.infer<typeof cvSectionSchema>;
export type PageText = z.infer<typeof pageTextSchema>;
export type Pages = z.infer<typeof pagesSchema>;
export type PageKey = keyof Pages;
