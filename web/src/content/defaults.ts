import type { CvSettings, PageKey, PageText, Pages, SiteContent } from '../types/content';

/**
 * The site's built-in text. Anything left empty in the studio falls back to these, so the site never
 * shows a blank heading, and the studio starts every field with this text ready to edit.
 */

export const CV_SECTION_KEYS = [
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'languages',
  'volunteering',
] as const;
export type CvSectionKey = (typeof CV_SECTION_KEYS)[number];

export const CV_SECTION_TITLES: Record<CvSectionKey, string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Work Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
  languages: 'Languages',
  volunteering: 'Volunteer Experience',
};

export const DEFAULT_CV: CvSettings = {
  headline: ['AI Software Engineer', 'Backend Developer'],
  summary:
    'Software engineer working on generative AI and backend systems. At SoftFlow Group I lead a team of three that ' +
    'builds AI agents with Azure OpenAI, Azure AI Foundry and Copilot Studio, using RAG over SharePoint and SQL ' +
    'Server data and deploying them in Microsoft Teams and WhatsApp. On the backend side I work with C#/.NET ' +
    '(ASP.NET Core, MVC), Java (Spring Boot) and Python: REST APIs, microservices, JWT/OAuth 2.0, Docker, and CI/CD ' +
    'pipelines in Azure DevOps. BSc in Computer Science, Antonine University (2026). Open to relocating.',
  location: 'Lebanon',
  availability: 'Open to relocation',
  showWebsite: true,
  projectStyle: 'summary',
  sections: CV_SECTION_KEYS.map((key) => ({ key, title: CV_SECTION_TITLES[key], visible: true })),
};

const page = (p: Partial<PageText>): PageText => ({
  kicker: '',
  title: '',
  accent: '',
  intro: '',
  lead: '',
  paragraphs: [],
  items: [],
  steps: [],
  ...p,
});

export const DEFAULT_PAGES: Pages = {
  home: page({
    lead: "The best technology disappears into the way people already work. That's why I build AI agents, WhatsApp bots, web apps and mobile apps that meet people where they are. And every project starts the same way: agreeing on what it should do, and what it should never do.",
    items: [
      'Microsoft Teams',
      'WhatsApp',
      'SharePoint',
      'Outlook',
      'Websites',
      'Mobile apps',
      'Copilot Studio',
      'Azure AI Foundry',
    ],
  }),
  about: page({
    kicker: 'About me',
    title: 'Software engineer working on generative AI and backend systems.',
    intro: 'Based in Lebanon and open to relocating.',
    lead: 'I lead a team of three at SoftFlow Group that builds AI agents people actually use at work.',
    paragraphs: [
      'We build with Azure OpenAI, Azure AI Foundry and Copilot Studio, using retrieval-augmented generation over SharePoint and SQL Server data, and deploy the agents in Microsoft Teams and WhatsApp. I split the work, set the technical approach for each project, and review what goes out to clients.',
      'Before an agent gets built, I meet the client to scope it: what data it can access, who uses it, and what it should not do.',
      'On the backend I work with C# and .NET (ASP.NET Core, MVC), Java with Spring Boot, and Python: REST APIs, microservices, JWT and OAuth 2.0, Docker, and CI/CD pipelines in Azure DevOps.',
      'I started at SoftFlow as an SPFx intern in 2024, grew into a junior developer and Copilot enablement role, and moved into AI engineering and team leadership in April 2026. I graduated in Computer Science from Antonine University in January 2026.',
    ],
  }),
  experience: page({
    kicker: 'Experience',
    title: 'From a Spring Boot internship to leading an AI team.',
  }),
  projects: page({
    kicker: 'Projects',
    title: "Things I've built.",
    intro: 'Personal projects and work I can share. Most of them are on GitHub.',
  }),
  services: page({
    kicker: 'Services',
    title: 'Pick what you need.',
    accent: "I'll build it.",
    intro:
      "Tap the services you're interested in, then send one request. Every project starts with a conversation about what it should do, and what it should never do.",
    steps: [
      {
        title: 'Scope',
        detail:
          'We meet and agree on what you need. For an AI agent: what data it can access, who uses it, and what it should not do.',
      },
      { title: 'Build', detail: 'I set the technical approach and build it, keeping you updated as it takes shape.' },
      {
        title: 'Review and launch',
        detail: 'Everything is reviewed before it goes out, then deployed where your team works.',
      },
    ],
  }),
  cv: page({
    title: 'My CV, always current',
    intro:
      'It is built from the same content as this site, so it changes whenever the site does. Read it here, or download it as an A4 PDF.',
  }),
  footer: page({
    kicker: 'Available for new projects',
    title: 'Have an idea?',
    accent: "Let's build it.",
    intro:
      'AI Software Engineer and Technical Lead at SoftFlow Group. I build AI agents, WhatsApp bots, web and mobile apps, and the backends behind them.',
  }),
};

const filled = <T>(v: T, fallback: T): T =>
  (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v != null) ? v : fallback;

/** A page's text with every empty field replaced by the built-in default. */
export function pageText(site: SiteContent, key: PageKey): PageText {
  const p = site.pages[key];
  const d = DEFAULT_PAGES[key];
  return {
    kicker: filled(p.kicker, d.kicker),
    title: filled(p.title, d.title),
    accent: filled(p.accent, d.accent),
    intro: filled(p.intro, d.intro),
    lead: filled(p.lead, d.lead),
    paragraphs: filled(
      p.paragraphs.filter((x) => x.trim()),
      d.paragraphs,
    ),
    items: filled(
      p.items.filter((x) => x.trim()),
      d.items,
    ),
    steps: filled(
      p.steps.filter((x) => x.title.trim()),
      d.steps,
    ),
  };
}

/** CV settings with empty fields replaced by the defaults, and any section missing from the list added at the end. */
export function cvSettings(site: SiteContent): CvSettings {
  const c = site.cv;
  const known = c.sections.filter((s) => CV_SECTION_KEYS.includes(s.key));
  const missing = CV_SECTION_KEYS.filter((k) => !known.some((s) => s.key === k)).map((key) => ({
    key,
    title: CV_SECTION_TITLES[key],
    visible: true,
  }));
  return {
    headline: filled(
      c.headline.filter((x) => x.trim()),
      DEFAULT_CV.headline,
    ),
    summary: filled(c.summary, DEFAULT_CV.summary),
    location: filled(c.location, DEFAULT_CV.location),
    availability: filled(c.availability, DEFAULT_CV.availability),
    showWebsite: c.showWebsite,
    projectStyle: c.projectStyle,
    sections: [...known, ...missing].map((s) => ({ ...s, title: s.title.trim() || CV_SECTION_TITLES[s.key] })),
  };
}

/** Content with every CV and page field filled in, for the studio to edit. */
export function withDefaults(site: SiteContent): SiteContent {
  const pages = Object.fromEntries(
    (Object.keys(DEFAULT_PAGES) as PageKey[]).map((k) => [k, pageText(site, k)]),
  ) as Pages;
  return { ...site, cv: cvSettings(site), pages };
}
