import type { CvSettings, PageCard, PageKey, PageSection, PageText, Pages, SiteContent } from '../types/content';

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
  headline: ['AI Software Engineer (C#/.NET)'],
  summary:
    'AI Software Engineer and Technical Lead building LLM-powered features and C#/.NET backends on Microsoft Azure. ' +
    'Lead a three-developer team delivering Azure OpenAI insights, JWT-secured ASP.NET Core REST APIs, and SQL Server ' +
    'integrations for an AI-enabled social media platform, plus Copilot Studio agents and WhatsApp AI assistants ' +
    'connected to Microsoft 365 through Microsoft Graph. Hands-on with RAG, PyTorch/Keras model training, Docker, and CI/CD.',
  location: 'Lebanon',
  availability: 'Open to relocation',
  showWebsite: true,
  projectStyle: 'summary',
  sections: CV_SECTION_KEYS.map((key) => ({ key, title: CV_SECTION_TITLES[key], visible: true })),
};

const card = (c: Partial<PageCard>): PageCard => ({ label: '', title: '', text: '', tags: [], stage: '', ...c });
const section = (x: Partial<PageSection>): PageSection => ({ title: '', intro: '', words: [], cards: [], ...x });

/**
 * The named sections of every page, with their built-in text. The studio's Page text tab edits these;
 * a field left empty shows the text here.
 */
export const DEFAULT_SECTIONS: Record<PageKey, Record<string, PageSection>> = {
  home: {
    hero: section({
      intro: "Type a question or tap a suggestion. Echo answers only from Daniel's CV.",
      cards: [
        card({ title: 'Request my services', text: 'AI agents, WhatsApp bots, websites, mobile apps and more' }),
        card({ title: 'Get to know me', text: 'My background, skills and education' }),
      ],
    }),
    strip: section({ title: 'What I work on' }),
    agents: section({
      title: 'How my agents work',
      cards: [
        card({
          title: 'A question comes in',
          text: 'Staff ask in plain language, inside Microsoft Teams or WhatsApp. No new app to learn.',
        }),
        card({
          title: 'The agent finds the right data',
          text: 'It searches SharePoint documents and SQL Server data using retrieval-augmented generation.',
        }),
        card({
          title: 'It answers, with the source',
          text: 'The reply is grounded in your own documents, so people can check where it came from.',
        }),
        card({
          title: "Scoped before it's built",
          text: 'We agree up front on what data it can access, who uses it, and what it should not do.',
        }),
      ],
    }),
    proof: section({
      title: 'Since September 2024',
      intro: 'Delivered at SoftFlow Group, for internal teams and clients.',
    }),
    reel: section({
      title: 'Selected projects',
      intro: 'Keep scrolling to move through them.',
      cards: [
        card({
          title: 'See every project in detail',
          text: 'Diagrams, a live pipeline demo and links to the code.',
          label: 'Open projects',
        }),
      ],
    }),
    marqueeTop: section({
      words: ['AI agents', 'WhatsApp bots', 'Websites', 'Mobile apps', 'SharePoint', 'Backend APIs'],
    }),
    marqueeBottom: section({
      words: ['Azure OpenAI', 'Copilot Studio', 'Microsoft Teams', 'C# and .NET', 'Spring Boot', 'React'],
    }),
    now: section({
      title: "What I'm working on",
      intro: "What I'm building now, and what comes next.",
      cards: [
        card({
          stage: 'now',
          label: 'In progress · SoftFlow Group',
          title: 'AI for a social media platform',
          text: 'Azure OpenAI features that turn social media and competitor data into account insights, best-time-to-post recommendations and competitor analysis, on a JWT-secured ASP.NET Core API that keeps every account’s data separate.',
          tags: ['Azure OpenAI', 'ASP.NET Core', 'SQL Server'],
        }),
        card({
          stage: 'next',
          label: 'Up next · Web, iOS and Android',
          title: 'Money tracker',
          text: 'A personal finance app on the web and on phones: log income and spending in seconds, set monthly budgets, and see where the money goes. One API keeps every device in sync.',
          tags: ['ASP.NET Core', 'React', 'Mobile', 'PostgreSQL'],
        }),
        card({
          stage: 'later',
          label: 'Planned · Side project',
          title: 'WhatsApp AI agent platform',
          text: 'A multi-tenant service where any business connects its WhatsApp number and its own documents, and gets an AI agent that answers customers, books appointments and hands the chat to a person when needed.',
          tags: ['ASP.NET Core', 'Azure OpenAI', 'WhatsApp Cloud API', 'Multi-tenant'],
        }),
      ],
    }),
  },
  about: {
    skills: section({ title: 'Skills', intro: 'Looking for something specific?' }),
  },
  experience: {
    glance: section({ title: 'My path at a glance', intro: 'Each bar is a role.' }),
    clients: section({ title: "Clients I've delivered for at SoftFlow" }),
    story: section({ title: 'The full story', intro: 'Scroll down the timeline, newest first.' }),
  },
  projects: {},
  services: {
    process: section({ title: "How we'd work together", intro: 'The same process I use with clients at SoftFlow.' }),
    request: section({ title: 'Request a service' }),
  },
  cv: {},
  footer: {},
};

/** Sections whose cards are a fixed set (buttons, the four agent steps): each card falls back on its own. */
export const FIXED_CARDS = new Set(['home.hero', 'home.agents', 'home.reel']);

const page = (p: Partial<PageText>): PageText => ({
  kicker: '',
  title: '',
  accent: '',
  intro: '',
  lead: '',
  paragraphs: [],
  items: [],
  steps: [],
  sections: {},
  order: [],
  hidden: [],
  ...p,
});

/** The blocks of a page that can be moved and switched off, in their built-in order. */
export const PAGE_BLOCKS: Partial<Record<PageKey, { key: string; label: string }[]>> = {
  home: [
    { key: 'strip', label: 'Moving strip' },
    { key: 'mani', label: 'Manifesto' },
    { key: 'agents', label: 'How my agents work' },
    { key: 'proof', label: 'Highlights' },
    { key: 'reel', label: 'Selected projects' },
    { key: 'marquee', label: 'Big moving words' },
    { key: 'now', label: "What I'm working on" },
  ],
};

/** A page's movable blocks in the order you set, without the ones switched off. */
export function pageLayout(site: SiteContent, key: PageKey): string[] {
  const known = (PAGE_BLOCKS[key] ?? []).map((b) => b.key);
  const p = site.pages[key];
  const set = (p.order ?? []).filter((k, i, a) => known.includes(k) && a.indexOf(k) === i);
  const all = [...set, ...known.filter((k) => !set.includes(k))];
  return all.filter((k) => !(p.hidden ?? []).includes(k));
}

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

for (const k of Object.keys(DEFAULT_SECTIONS) as PageKey[]) DEFAULT_PAGES[k].sections = DEFAULT_SECTIONS[k];

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
    order: p.order ?? [],
    hidden: p.hidden ?? [],
    sections: Object.fromEntries(
      Object.entries(DEFAULT_SECTIONS[key]).map(([k, ds]) => [
        k,
        mergeSection(p.sections?.[k], ds, FIXED_CARDS.has(`${key}.${k}`)),
      ]),
    ),
  };
}

function mergeSection(s: PageSection | undefined, d: PageSection, fixed: boolean): PageSection {
  const words = (s?.words ?? []).filter((w) => w.trim());
  const cards = (s?.cards ?? []).filter((c) => c.title.trim() || c.text.trim());
  return {
    title: filled(s?.title ?? '', d.title),
    intro: filled(s?.intro ?? '', d.intro),
    words: filled(words, d.words),
    cards: fixed
      ? d.cards.map((dc, i) => {
          const c = s?.cards?.[i];
          return {
            ...dc,
            label: filled(c?.label ?? '', dc.label),
            title: filled(c?.title ?? '', dc.title),
            text: filled(c?.text ?? '', dc.text),
          };
        })
      : filled(cards, d.cards),
  };
}

/** One section of a page, with the built-in text filling anything left empty. */
export const pageSection = (site: SiteContent, key: PageKey, name: string): PageSection =>
  pageText(site, key).sections[name] ?? section({});

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
