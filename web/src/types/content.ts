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
});

export type SiteContent = z.infer<typeof siteContentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type Service = z.infer<typeof serviceSchema>;
