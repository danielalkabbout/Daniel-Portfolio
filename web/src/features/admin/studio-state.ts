import { createContext, useContext, type ReactNode } from 'react';
import type { SiteContent } from '../../types/content';
import type { Field } from './fields';

export type Obj = Record<string, unknown>;

export interface DrawerSpec {
  title: string;
  cur: Obj;
  fields: (cur: Obj) => Field[];
  onSave: (cur: Obj) => void;
  preview?: (cur: Obj) => ReactNode;
  /** Optional fix-ups applied to the item whenever a field changes. */
  onChange?: (cur: Obj, key: string) => Obj;
}

export type Tab =
  | 'overview'
  | 'requests'
  | 'projects'
  | 'experience'
  | 'skills'
  | 'services'
  | 'profile'
  | 'about'
  | 'data'
  | 'activity';

export interface StudioApi {
  d: SiteContent;
  base: SiteContent;
  /** Applies a change to a copy of the draft. */
  update: (fn: (d: SiteContent) => void) => void;
  replace: (d: SiteContent) => void;
  open: (spec: DrawerSpec) => void;
  show: (t: Tab) => void;
  token: string;
}

export const StudioCtx = createContext<StudioApi>(null as unknown as StudioApi);
export const useStudio = () => useContext(StudioCtx);

export const SECTIONS = [
  'profile',
  'highlights',
  'projects',
  'experience',
  'clients',
  'skills',
  'services',
  'education',
  'certifications',
  'languages',
  'volunteering',
] as const;
export const LABEL: Record<(typeof SECTIONS)[number], string> = {
  profile: 'Profile',
  highlights: 'Home highlights',
  projects: 'Projects',
  experience: 'Experience',
  clients: 'Clients',
  skills: 'Skills',
  services: 'Services',
  education: 'Education',
  certifications: 'Certifications',
  languages: 'Languages',
  volunteering: 'Volunteering',
};

export function changedSections(d: SiteContent, base: SiteContent) {
  return SECTIONS.filter((k) => JSON.stringify(d[k]) !== JSON.stringify(base[k]));
}

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export function slug(t: string, list: { id: string }[], self?: unknown) {
  let s =
    String(t || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'item';
  const b = s;
  let i = 2;
  while (list.some((x) => x !== self && x.id === s)) s = `${b}-${i++}`;
  return s;
}

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtM(v?: string | null) {
  if (!v) return 'Present';
  const [y, m] = v.split('-');
  return `${SHORT[Number(m) - 1]} ${y}`;
}
