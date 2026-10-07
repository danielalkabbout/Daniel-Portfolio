/* Echo's rule engine data: answers questions about Daniel from his CV, instantly and offline.
   Ported from the original site. Answers are trusted HTML written here, never built from user input. */

export interface Intent {
  id: string;
  k: string[];
  a: string;
  m?: string;
  f: string[];
}
export interface EchoContext {
  email: string;
  wa: string;
  li: string;
  gh: string;
}

export const BASE_SKILLS: Record<string, string[]> = {
  'AI and machine learning': [
    'generative ai',
    'llm',
    'llms',
    'large language models',
    'ai agents',
    'agents',
    'rag',
    'retrieval-augmented generation',
    'azure openai',
    'azure ai foundry',
    'copilot studio',
    'gpt-4o mini',
    'gpt',
    'azure ai speech',
    'speech-to-text',
    'prompt engineering',
    'embeddings',
    'vector search',
    'machine learning',
    'deep learning',
    'cnn',
    'computer vision',
    'object detection',
    'yolov8',
    'yolo',
    'nlp',
    'natural language processing',
  ],
  'programming languages': [
    'c#',
    'csharp',
    'java',
    'python',
    'typescript',
    'javascript',
    'sql',
    'react',
    'react native',
    'html',
    'css',
  ],
  backend: [
    '.net',
    'dotnet',
    'asp.net core',
    'asp.net',
    'asp.net mvc',
    'mvc',
    'web api',
    'spring boot',
    'spring',
    'hibernate',
    'jpa',
    'entity framework',
    'ef core',
    'flask',
    'node.js',
    'node',
    'rest',
    'rest api',
    'restful',
    'microservices',
    'webhooks',
    'api integration',
  ],
  security: ['authentication', 'authorization', 'jwt', 'oauth', 'oauth 2.0', 'spring security', 'rbac', 'cors', 'csrf'],
  databases: ['sql server', 'mssql', 'mysql', 'mongodb', 'nosql', 'relational databases'],
  'cloud and DevOps': ['azure', 'azure devops', 'ci/cd', 'cicd', 'docker', 'git', 'github'],
  'Microsoft and integrations': [
    'whatsapp cloud api',
    'meta graph api',
    'microsoft graph',
    'graph api',
    'microsoft 365',
    'sharepoint',
    'spfx',
    'microsoft teams',
    'teams',
    'power automate',
    'power apps',
    'power platform',
  ],
  practices: ['oop', 'sdlc', 'code review', 'technical leadership', 'requirements gathering'],
};

export const NOT_LISTED: string[] = [
  'kubernetes',
  'k8s',
  'aws',
  'amazon web services',
  'gcp',
  'google cloud',
  'golang',
  'go lang',
  'rust',
  'php',
  'laravel',
  'ruby',
  'rails',
  'swift',
  'kotlin',
  'flutter',
  'dart',
  'angular',
  'vue',
  'svelte',
  'next.js',
  'nextjs',
  'django',
  'fastapi',
  'tensorflow',
  'pytorch',
  'langchain',
  'pinecone',
  'terraform',
  'jenkins',
  'postgres',
  'postgresql',
  'redis',
  'kafka',
  'graphql',
  'unity',
  'c++',
  'scala',
  'figma',
  'firebase',
];

export const DISPLAY: Record<string, string> = {
  '.net': '.NET',
  dotnet: '.NET',
  'c#': 'C#',
  csharp: 'C#',
  'sql server': 'SQL Server',
  mssql: 'SQL Server',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  nosql: 'NoSQL',
  'azure devops': 'Azure DevOps',
  'ci/cd': 'CI/CD',
  cicd: 'CI/CD',
  jwt: 'JWT',
  oauth: 'OAuth',
  'oauth 2.0': 'OAuth 2.0',
  rag: 'RAG',
  llm: 'LLMs',
  llms: 'LLMs',
  cnn: 'CNNs',
  nlp: 'NLP',
  yolov8: 'YOLOv8',
  yolo: 'YOLO',
  spfx: 'SPFx',
  'asp.net core': 'ASP.NET Core',
  'asp.net': 'ASP.NET',
  'asp.net mvc': 'ASP.NET MVC',
  mvc: 'MVC',
  'node.js': 'Node.js',
  node: 'Node.js',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  github: 'GitHub',
  rest: 'REST',
  'rest api': 'REST APIs',
  restful: 'RESTful APIs',
  jpa: 'JPA',
  rbac: 'RBAC',
  cors: 'CORS',
  csrf: 'CSRF',
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',
  oop: 'OOP',
  sdlc: 'SDLC',
  'gpt-4o mini': 'GPT-4o mini',
  gpt: 'GPT',
  'ef core': 'EF Core',
  'azure openai': 'Azure OpenAI',
  'azure ai foundry': 'Azure AI Foundry',
  'azure ai speech': 'Azure AI Speech',
  'web api': 'Web API',
  'power bi': 'Power BI',
  aws: 'AWS',
  gcp: 'GCP',
  php: 'PHP',
  'c++': 'C++',
  graphql: 'GraphQL',
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  fastapi: 'FastAPI',
  pytorch: 'PyTorch',
  tensorflow: 'TensorFlow',
  langchain: 'LangChain',
  'next.js': 'Next.js',
  nextjs: 'Next.js',
  k8s: 'Kubernetes',
  'whatsapp cloud api': 'WhatsApp Cloud API',
  'meta graph api': 'Meta Graph API',
  'microsoft graph': 'Microsoft Graph',
  'graph api': 'Graph API',
  'ai agents': 'AI agents',
  'generative ai': 'Generative AI',
};

export const CHIP_MAP: Record<string, string> = {
  'Who is Daniel?': 'about',
  'What does he build?': 'agents',
  'Can I hire him?': 'hire',
  'Current role?': 'role',
  'His projects': 'projects',
  'All projects': 'projects',
  'Is he open to relocating?': 'loc',
  'Where is he based?': 'loc',
  'Tell me more': '__more',
  'His AI agents': 'agents',
  'Full experience': 'exp',
  Experience: 'exp',
  'How does he scope agents?': 'scope',
  'WhatsApp work': 'whatsapp',
  'Can I hire him for an agent?': 'hire',
  'His stack': 'stack',
  Skills: 'stack',
  'WhatsApp AI Assistant': 'p_assist',
  'Request a WhatsApp bot': 'hire',
  'SharePoint work': 'spfx',
  Internships: 'intern',
  'Copilot training': 'training',
  'Request SharePoint work': 'hire',
  'Can I book a training?': 'hire',
  'Noise cancellation': 'p_noise',
  'Open GitHub': '__gh',
  'Object detection project': 'p_yolo',
  'ML background': 'ml',
  'His backend skills': 'stack',
  'Does he know Docker?': '__docker',
  'Security skills': 'security',
  Projects: 'projects',
  Certifications: 'certs',
  Education: 'edu',
  'Remote work?': 'remote',
  'How do I contact him?': 'contact',
  Contact: 'contact',
  'Pricing?': 'price',
  'What services?': 'hire',
};

export function btn(label: string, href: string, primary?: boolean) {
  return (
    '<a class="cb' +
    (primary ? ' p' : '') +
    '" href="' +
    href +
    '"' +
    (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '') +
    '>' +
    label +
    '</a>'
  );
}

export function contactCardHtml(c: EchoContext) {
  return (
    '<div class="ccard"><b>Reach Daniel directly</b>' +
    btn('Email', 'mailto:' + c.email, true) +
    btn('WhatsApp', c.wa) +
    btn('LinkedIn', c.li) +
    '</div>'
  );
}

function projRow(t: string, d: string) {
  return '<a class="prow" href="/projects"><b>' + t + '</b><span>' + d + '</span></a>';
}

export function buildIntents(c: EchoContext): Intent[] {
  const EMAIL = c.email;
  const GH = c.gh;
  const contactCard = contactCardHtml(c);
  return [
    {
      id: 'greet',
      k: ['hi', 'hello', 'hey', 'hiya', 'good morning', 'good evening', 'salut', 'bonjour', 'marhaba', 'hala', 'yo'],
      a: "Hi! I'm Echo, Daniel's assistant. Ask me about his work, projects, skills, or how to hire him.",
      f: ['Who is Daniel?', 'What does he build?', 'Can I hire him?'],
    },
    {
      id: 'bot',
      k: [
        'echo',
        'your name',
        'are you real',
        'are you a bot',
        'are you ai',
        'are you human',
        'who are you',
        'what are you',
        'chatgpt',
        'is this daniel',
      ],
      a: "I'm Echo, Daniel's assistant, not Daniel himself. I answer from his CV, so if something isn't in it, I'll tell you instead of guessing. For anything personal, reach him directly.",
      f: ['How do I contact him?', 'What does he build?'],
    },
    {
      id: 'about',
      k: [
        'who is',
        'about daniel',
        'about him',
        'tell me about',
        'introduce',
        'summary',
        'background',
        'yourself',
        "who's daniel",
        'overview',
      ],
      a: 'Daniel Al Kabbout is an AI Software Engineer and Technical Lead at SoftFlow Group in Lebanon. He leads a team of three building AI agents with Azure OpenAI, Azure AI Foundry and Copilot Studio, using RAG over SharePoint and SQL Server data, deployed in Microsoft Teams and WhatsApp. On the backend he works with C#/.NET, Java (Spring Boot) and Python.',
      m: 'He started at SoftFlow as an SPFx intern in June 2024, became a junior developer and Copilot enablement officer that September, and moved into AI engineering and team leadership in April 2026. He graduated in Computer Science from Antonine University in January 2026.',
      f: ['Current role?', 'His projects', 'Is he open to relocating?'],
    },
    {
      id: 'role',
      k: [
        'current role',
        'current job',
        'job',
        'role',
        'position',
        'title',
        'softflow',
        'where does he work',
        'works at',
        'work now',
        'employer',
        'company',
      ],
      a: "Since April 2026 he's been AI Software Engineer and Technical Lead at SoftFlow Group. He leads three developers: he splits the work, sets the technical approach for each project, and reviews what goes out to clients.",
      m: 'Recent work there: two Copilot Studio agents deployed in Teams, a WhatsApp bot for The Net Holding including their Meta Business Verification, and now AI features for an enterprise social media product with Azure OpenAI.',
      f: ['Tell me more', 'His AI agents', 'Full experience'],
    },
    {
      id: 'team',
      k: ['team', 'lead', 'leadership', 'manage', 'manager', 'leading'],
      a: "He leads a team of three developers at SoftFlow Group. He splits the work, sets the technical approach for each project, reviews what goes out to clients, and meets clients to scope each agent before it's built.",
      f: ['How does he scope agents?', 'Current role?'],
    },
    {
      id: 'scope',
      k: ['scope', 'scoping', 'requirements', 'process', 'how does he work', 'approach', 'client meeting'],
      a: 'Before building an agent, he meets the client to agree on three things: what data it can access, who uses it, and what it should not do. Then the team builds, and he reviews everything before it goes out.',
      f: ['Can I hire him?', 'His AI agents'],
    },
    {
      id: 'agents',
      k: [
        'agent',
        'agents',
        'copilot',
        'copilot studio',
        'rag',
        'chatbot',
        'knowledge',
        'teams bot',
        'ai solutions',
        'generative',
      ],
      a: 'At SoftFlow he built two Copilot Studio agents that answer staff questions from SharePoint documents and SQL Server data, deployed in Microsoft Teams. His team builds agents with Azure OpenAI, Azure AI Foundry and Copilot Studio, using retrieval-augmented generation.',
      f: ['WhatsApp work', 'Can I hire him for an agent?', 'His stack'],
    },
    {
      id: 'whatsapp',
      k: ['whatsapp', 'net holding', 'meta', 'business verification', 'cloud api', 'wa bot'],
      a: 'He built a WhatsApp bot for The Net Holding on the WhatsApp Cloud API and handled their Meta Business Verification, including fixing rejected documents and verifying the domain.',
      m: 'On his own he built a WhatsApp AI Assistant for Microsoft 365 (SharePoint, Outlook, Calendar and Teams through Microsoft Graph, with GPT-4o mini and voice messages via Azure AI Speech) and a WhatsApp appointment booking bot for doctors.',
      f: ['Tell me more', 'WhatsApp AI Assistant', 'Request a WhatsApp bot'],
    },
    {
      id: 'social',
      k: ['social media', 'working on now', 'currently', 'right now', 'latest', 'recent'],
      a: "Right now he's adding AI features to an enterprise social media product using Azure OpenAI.",
      f: ['Current role?', 'His AI agents'],
    },
    {
      id: 'exp',
      k: [
        'experience',
        'career',
        'history',
        'worked',
        'previous',
        'companies',
        'years',
        'work history',
        'timeline',
        'resume history',
      ],
      a:
        'Five roles since February 2024:<div class="tlc"><p><b>AI Software Engineer / Technical Lead</b><span>SoftFlow Group, Apr 2026 to present</span></p><p><b>Junior Software Developer and Copilot Enablement Officer</b><span>SoftFlow Group, Sep 2024 to Mar 2026</span></p><p><b>SPFx Developer Intern</b><span>SoftFlow Group, Jun to Aug 2024</span></p><p><b>Front-End Developer Intern (part-time)</b><span>Professional Computers, Jun to Aug 2024</span></p><p><b>Java and Spring Boot Intern</b><span>Eurisko Mobility, Feb to Apr 2024</span></p></div>' +
        btn('See the full timeline', '/experience'),
      f: ['Current role?', 'SharePoint work', 'Internships'],
    },
    {
      id: 'spfx',
      k: [
        'sharepoint',
        'spfx',
        'web part',
        'web parts',
        'power automate',
        'power apps',
        'power platform',
        'flows',
        'junior',
      ],
      a: 'As a junior developer (Sep 2024 to Mar 2026) he developed 12 SPFx web parts in React and TypeScript, 8 for SharePoint Online and 4 for on-premises, and built around 10 Power Automate flows and Power Apps forms, mostly for approvals and requests that used to go through email. He also worked on backend features in C#, ASP.NET MVC and SQL Server.',
      f: ['Copilot training', 'Request SharePoint work'],
    },
    {
      id: 'training',
      k: ['training', 'trainings', 'sessions', 'afc', 'aishti', 'aïshti', 'enablement', 'teach', 'workshop'],
      a: 'He ran 12 Microsoft Copilot training sessions for managers and staff at AFC, AFC Live and Aïshti.',
      f: ['Can I book a training?', 'Full experience'],
    },
    {
      id: 'intern',
      k: ['intern', 'internship', 'internships', 'eurisko', 'professional computers', 'first job', 'started'],
      a: 'At Eurisko Mobility (Feb to Apr 2024) he built REST APIs in Spring Boot with Hibernate/JPA and added login and role-based access with Spring Security, JWT and OAuth2. At Professional Computers (Jun to Aug 2024, part-time) he designed the vendor dashboard for a multi-vendor e-commerce site and built the vendor shop pages. The same summer he was an SPFx intern at SoftFlow.',
      f: ['Full experience', 'His stack'],
    },
    {
      id: 'projects',
      k: ['projects', 'project', 'portfolio', 'built', 'side project', 'github', 'repos', 'showcase', 'examples'],
      a:
        'Here are his personal projects:' +
        projRow('WhatsApp AI Assistant for Microsoft 365', 'SharePoint, Outlook, Calendar and Teams from WhatsApp') +
        projRow('Live noise cancellation model', 'CNN on UrbanSound8K plus spectral gating') +
        projRow('WhatsApp appointment booking bot', "Doctors' appointments, stored in SQL") +
        projRow('Apple and banana detection app', 'Custom-trained YOLOv8s in a Flask app') +
        projRow('To-do REST API', 'ASP.NET Core, EF Core and MySQL'),
      f: ['WhatsApp AI Assistant', 'Noise cancellation', 'Open GitHub'],
    },
    {
      id: 'p_assist',
      k: ['whatsapp ai assistant', 'microsoft 365', 'graph', 'assistant project', 'outlook', 'calendar', 'voice'],
      a:
        'His WhatsApp AI Assistant for Microsoft 365 connects WhatsApp to SharePoint, Outlook, Outlook Calendar and Microsoft Teams through the Microsoft Graph API, with a GPT-4o mini assistant built in. Users can ask about SharePoint files, upload files to SharePoint from WhatsApp, write and send emails, and schedule meetings. Voice messages are transcribed with Azure AI Speech.' +
        btn('See the diagram', '/projects') +
        btn('Code on GitHub', GH + '/WhatsApp-Chatbot'),
      f: ['Noise cancellation', 'His stack'],
    },
    {
      id: 'p_noise',
      k: ['noise', 'audio', 'urbansound', 'noisereduce', 'cancellation', 'spectral'],
      a:
        "He trained a CNN on the UrbanSound8K dataset to classify the background noise in an audio clip, then removes it with spectral gating (noisereduce) using reference recordings of each noise type. It's integrated with Microsoft Teams." +
        btn('Run the demo', '/projects'),
      f: ['Object detection project', 'All projects'],
    },
    {
      id: 'p_yolo',
      k: ['yolo', 'yolov8', 'apple', 'banana', 'detection', 'computer vision', 'object detection', 'flask'],
      a:
        'His apple and banana detection app is a Flask web app that runs a custom-trained YOLOv8s model on uploaded photos and draws labelled bounding boxes around each apple and banana.' +
        btn('Code on GitHub', GH + '/Apple-Banana-Detector'),
      f: ['All projects', 'ML background'],
    },
    {
      id: 'p_doc',
      k: ['doctor', 'doctors', 'appointment', 'booking', 'clinic', 'patients'],
      a: "He built a WhatsApp chatbot that lets patients book appointments with doctors, with bookings stored in a SQL database. It's written in TypeScript on the WhatsApp Cloud API.",
      f: ['Request a WhatsApp bot', 'All projects'],
    },
    {
      id: 'p_todo',
      k: ['todo', 'to-do', 'taskify', 'task api', 'tasks'],
      a:
        'His to-do REST API is an ASP.NET Core backend for creating, updating and tracking tasks, using Entity Framework Core with MySQL.' +
        btn('Code on GitHub', GH + '/Taskify'),
      f: ['His backend skills', 'All projects'],
    },
    {
      id: 'ml',
      k: ['ml', 'ai background', 'machine learning', 'deep learning', 'data science', 'zaka', 'neural'],
      a: 'He completed the Machine Learning Specialization at Zaka in 2025 (data science, deep learning, computer vision, NLP, ML in production). Hands-on, he trained a CNN for noise classification and a YOLOv8s object detector.',
      f: ['Noise cancellation', 'Certifications'],
    },
    {
      id: 'stack',
      k: [
        'stack',
        'skills',
        'technologies',
        'tech',
        'tools',
        'programming',
        'languages does he code',
        'what does he use',
        'frameworks',
        'backend skills',
      ],
      a:
        '<b>AI:</b> Azure OpenAI, Azure AI Foundry, Copilot Studio, RAG, embeddings, vector search, GPT-4o mini, Azure AI Speech, CNNs, YOLOv8.<br><b>Backend:</b> C#/.NET (ASP.NET Core, MVC), Java (Spring Boot, Hibernate), Python (Flask), Node.js, REST, microservices.<br><b>Data:</b> SQL Server, MySQL, MongoDB. <b>DevOps:</b> Azure DevOps CI/CD, Docker, Git.<br><b>Frontend:</b> React, React Native, TypeScript.' +
        btn('All skills', '/about'),
      f: ['Does he know Docker?', 'Security skills', 'Projects'],
    },
    {
      id: 'security',
      k: ['security', 'auth', 'jwt', 'oauth', 'spring security', 'rbac', 'cors', 'csrf', 'login'],
      a: 'Security on his CV: authentication and authorization, JWT, OAuth 2.0, Spring Security, role-based access control, CORS and CSRF. He applied these at Eurisko Mobility and in his own APIs.',
      f: ['His stack', 'Internships'],
    },
    {
      id: 'edu',
      k: [
        'education',
        'degree',
        'university',
        'study',
        'studied',
        'graduate',
        'graduated',
        'antonine',
        'bsc',
        'college',
        'school',
      ],
      a: 'He holds a BSc in Computer Science from Antonine University in Lebanon, graduated January 2026.',
      f: ['Certifications', 'Experience'],
    },
    {
      id: 'certs',
      k: ['certification', 'certifications', 'certificate', 'certificates', 'courses', 'course', 'udemy'],
      a: 'Certifications: Machine Learning Specialization (Zaka, 2025); Master Spring Boot 3 and Spring Framework 6; Spring Security with JWT and OAuth2; Mastering SPFx Development using React and Node.js; and Complete Guide to Microsoft SharePoint Online (all four on Udemy).',
      f: ['Education', 'ML background'],
    },
    {
      id: 'langs',
      k: ['speak', 'spoken', 'arabic', 'french', 'english', 'language', 'languages', 'fluent'],
      a: 'He speaks Arabic natively, and English and French at a professional working level.',
      f: ['Where is he based?', 'Can I hire him?'],
    },
    {
      id: 'loc',
      k: [
        'where',
        'based',
        'location',
        'live',
        'lebanon',
        'relocate',
        'relocation',
        'move',
        'abroad',
        'country',
        'visa',
      ],
      a: "He's based in Lebanon and open to relocating.",
      f: ['Remote work?', 'How do I contact him?'],
    },
    {
      id: 'remote',
      k: ['remote', 'remotely', 'hybrid', 'work from home', 'timezone', 'time zone'],
      a:
        "His CV says he's open to relocating. For remote or hybrid arrangements, it's best to ask him directly." +
        contactCard,
      f: ['Can I hire him?'],
    },
    {
      id: 'hire',
      k: [
        'hire',
        'hiring',
        'services',
        'service',
        'freelance',
        'available',
        'availability',
        'work with',
        'contract',
        'project for',
        'build for',
        'collaborate',
        'offer',
      ],
      a:
        'Yes. He takes on AI agents on your company data, WhatsApp bots, websites and web apps, mobile apps, SharePoint and Power Platform work, backend APIs, and Microsoft Copilot training.' +
        btn('Request a service', '/services', true) +
        btn('Email him', 'mailto:' + EMAIL),
      f: ['How does he scope agents?', 'Pricing?', 'Contact'],
    },
    {
      id: 'job',
      k: [
        'job offer',
        'recruit',
        'recruiter',
        'opportunity',
        'open to work',
        'looking for',
        'interview',
        'position open',
        'full time',
        'full-time',
      ],
      a:
        "He's open to AI engineer and backend roles, and to relocating. The fastest way to reach him is email." +
        contactCard,
      f: ['Experience', 'His stack'],
    },
    {
      id: 'price',
      k: ['price', 'pricing', 'cost', 'rate', 'rates', 'budget', 'charge', 'fee', 'how much', 'quote'],
      a:
        "It depends on the scope. Send him a short description through the request form and he'll reply with an estimate." +
        btn('Request a quote', '/services', true),
      f: ['What services?', 'Contact'],
    },
    {
      id: 'salary',
      k: ['salary', 'compensation', 'expected salary', 'pay', 'paid'],
      a: "That's something he'd rather discuss directly." + contactCard,
      f: ['Experience'],
    },
    {
      id: 'contact',
      k: [
        'contact',
        'email',
        'phone',
        'number',
        'reach',
        'call',
        'message him',
        'linkedin',
        'get in touch',
        'whatsapp number',
      ],
      a: "Here's how to reach him:" + contactCard,
      f: ['Can I hire him?', 'Where is he based?'],
    },
    {
      id: 'cv',
      k: ['cv', 'resume', 'résumé', 'download cv'],
      a:
        "Ask him by email and he'll send his latest CV. Most of it is already on this site." +
        btn('Email for CV', 'mailto:' + EMAIL + '?subject=CV%20request', true) +
        btn('Experience', '/experience'),
      f: ['Experience', 'Skills'],
    },
    {
      id: 'volunteer',
      k: ['volunteer', 'volunteering', 'charity', 'beirut', 'explosion', 'nazareth'],
      a: 'In 2020 he volunteered with Equipe Missionaire de Nazareth in Lebanon, helping distribute food to more than 500 families after the Beirut port explosion.',
      f: ['Who is Daniel?'],
    },
    {
      id: 'model',
      k: ['which model', 'what model', 'gpt', 'openai', 'llm', 'llms', 'azure openai', 'claude', 'gemini'],
      a: 'His work uses Azure OpenAI, Azure AI Foundry and Copilot Studio. His WhatsApp AI Assistant uses GPT-4o mini.',
      f: ['His AI agents', 'His stack'],
    },
    {
      id: 'thanks',
      k: ['thanks', 'thank you', 'thx', 'merci', 'shukran', 'great', 'awesome', 'cool', 'nice', 'perfect'],
      a: "You're welcome! Anything else you'd like to know?",
      f: ['Can I hire him?', 'Contact'],
    },
    {
      id: 'bye',
      k: ['bye', 'goodbye', 'see you', 'later', 'ciao'],
      a:
        'Thanks for stopping by! If you have a project in mind, the request form is the fastest route.' +
        btn('Request a service', '/services', true),
      f: [],
    },
    {
      id: 'personal',
      k: ['age', 'old is', 'married', 'wife', 'girlfriend', 'religion', 'hobbies', 'hobby', 'birthday'],
      a: "I only know what's on his CV, and that isn't on it. You can ask him directly." + contactCard,
      f: ['Who is Daniel?'],
    },
  ];
}
