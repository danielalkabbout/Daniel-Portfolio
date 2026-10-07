/* Icons and small decorative visuals. Kept as SVG strings so the exact artwork from the design is reused. */

export const ICON_PATHS: Record<string, string> = {
  whatsapp: '<path d="M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>',
  noise: '<path d="M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4"/>',
  booking: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 15l2 2 4-4"/>',
  detector:
    '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  todo: '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>',
  web: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  mobile: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  ai: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  rocket:
    '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M14.5 4.5c3-1.5 5.5-1.5 5.5-1.5s0 2.5-1.5 5.5L12 15l-3-3z"/><path d="M9 12l-3-1 3-4h4M12 15l1 3 4-3v-4"/>',
};

export const ICON_CHOICES: [string, string][] = [
  ['rocket', 'Rocket'],
  ['ai', 'Sparkle (AI)'],
  ['whatsapp', 'Chat'],
  ['web', 'Browser'],
  ['mobile', 'Phone'],
  ['data', 'Database'],
  ['todo', 'Code'],
  ['detector', 'Vision'],
  ['noise', 'Audio'],
  ['booking', 'Calendar'],
];

export function iconSvg(name: string | undefined, sw = 1.8) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name ?? ''] ?? ICON_PATHS.rocket}</svg>`;
}

/** Project/category icon. */
export function Icon({ name, sw = 1.8 }: { name?: string; sw?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name ?? ''] ?? ICON_PATHS.rocket }}
    />
  );
}

export const SERVICE_VISUALS: Record<string, string> = {
  ai: '<div class="vz vz-ai"><span class="core"></span><i class="orb o1"></i><i class="orb o2"></i><i class="orb o3"></i><em class="tg t1">SharePoint</em><em class="tg t2">SQL Server</em><em class="tg t3">Teams</em></div>',
  wa: '<div class="vz vz-wa"><span class="cb1">Book for Thursday?</span><span class="cb2">Booked ✓</span><span class="cb3"><i></i><i></i><i></i></span></div>',
  web: '<div class="vz vz-web"><div class="bw"><b><i></i><i></i><i></i></b><span class="l1"></span><span class="l2"></span><span class="l3"></span><span class="l4"></span></div></div>',
  mob: '<div class="vz vz-mob"><div class="ph"><span class="c1"></span><span class="c2"></span><span class="c3"></span></div></div>',
  sp: '<div class="vz vz-sp"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>',
  api: '<div class="vz vz-api"><code><b>GET</b> /api/tasks</code><code class="ok">200 OK</code><code><b>POST</b> /api/tasks</code><code class="ok">201 Created</code></div>',
  tr: '<div class="vz vz-tr"><i style="--h:40%"></i><i style="--h:65%"></i><i style="--h:50%"></i><i style="--h:85%"></i><i style="--h:70%"></i></div>',
  generic: '<div class="vz vz-gen"><span></span><span></span><span></span></div>',
};

export const VISUAL_CHOICES: [string, string][] = [
  ['ai', 'AI orbit'],
  ['wa', 'Chat bubbles'],
  ['web', 'Browser window'],
  ['mob', 'Phone'],
  ['sp', 'Tile grid'],
  ['api', 'Terminal'],
  ['tr', 'Bar chart'],
  ['generic', 'Sparkle (generic)'],
];

export const visualKey = (v: string | undefined) => (v && SERVICE_VISUALS[v] ? v : 'generic');

export function GitHubIcon() {
  return <span className="gh-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GITHUB_SVG }} />;
}

export function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4z" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z" />
    </svg>
  );
}

export function ArrowRight({ sw = 2.2 }: { sw?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowUpRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}

export const GITHUB_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>';
