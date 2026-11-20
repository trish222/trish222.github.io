// Everything the screen says about Trish, independent of the OS theme that shows it
// (docs/scene-contract.md, "Screen OS themes"). Plain strings only: the theme escapes them.
export const CONTENT = {
  owner: { name: 'Trish Nguyen', title: 'Software Developer', avatar: '👩‍💻' },

  about: [
    'Hi! I\'m Trish — a web developer who loves building things for the web.',
    'Welcome to my portfolio, circa 1995.',
  ],

  // `id` names the floppy's card; descriptions are placeholders until P8's content audit.
  projects: [
    { id: 'moneyflow', title: 'MONEYFLOW', name: 'MoneyFlow', icon: '💻', tags: ['React', 'Node.js', 'PostgreSQL'],
      description: 'A web app built with React and Node.js. Replace this with your real project description.' },
    { id: 'cook', title: 'COOK', name: 'Cook', icon: '🌐', tags: ['Python', 'Flask'],
      description: 'Another cool project. Replace this with your real project description.' },
    { id: 'microlearning', title: 'MICROLEARNING', name: 'Microlearning', icon: '📱', tags: ['TypeScript', 'Vue'],
      description: 'Mobile-friendly application. Replace this with your real project description.' },
  ],

  contact: [
    { label: 'Email', text: 'hello@example.com', href: 'mailto:hello@example.com' },
    { label: 'GitHub', text: 'github.com/trish222', href: 'https://github.com/trish222' },
    { label: 'LinkedIn', text: 'linkedin.com/in/trish', href: '#' },
  ],

  // Follows Trish_Nguyen_Resume.pdf.
  resume: {
    links: [
      [{ text: 'trishnguyen955@gmail.com', href: 'mailto:trishnguyen955@gmail.com' },
        { text: '984-242-5156', href: 'tel:+19842425156' }],
      [{ text: 'linkedin.com/in/trish-nguyen-a69350243', href: 'https://www.linkedin.com/in/trish-nguyen-a69350243/' }],
    ],
    education: [
      { what: 'North Carolina State University', when: 'Aug 2024 – Dec 2027', where: 'Raleigh, NC',
        notes: ['Bachelor of Computer Science',
          'Coursework: Software Development Fundamentals, Data Structures and Algorithms, C and Software Tools, Operating Systems'] },
      { what: 'Wake Technical Community College', when: 'Aug 2022 – May 2024', where: 'Raleigh, NC',
        notes: ['Associate in Science, Associate in Engineering'] },
    ],
    skills: [
      ['Languages & Frameworks', 'Java, Python, C, HTML, CSS, JavaScript, React'],
      ['AI & Developer Tools', 'GitHub Copilot, Claude Code, Copilot CLI, Git/GitHub, Docker'],
      ['Workflows', 'Agile (Scrum, Kanban), Jira, sprint planning, code reviews'],
      ['Tools & Platforms', 'Visual Studio Code, Eclipse, JUnit, Jenkins, SolidWorks, Adobe Photoshop'],
      ['IT & Systems', 'ServiceNow, PXE boot imaging, Windows, macOS'],
    ],
    experience: [
      { what: 'Software Engineering Intern', when: 'May 2026 – Present', where: 'SAS Institute · Cary, NC', bullets: [
        'Developed an agentic testing pipeline leveraging Copilot skills and an internal RAG architecture for the Customer Intelligence 360 Web/Mobile team',
        'Generated unit, integration, and e2e test scaffolds to fill missing coverage, flagged by automated quality audits of modules with as low as ~70% coverage',
        'Worked in Agile/Scrum sprints, tracking tasks in Jira and participating in daily stand-ups and sprint reviews'] },
      { what: 'Student Web Developer', when: 'Sep 2025 – Present', where: 'North Carolina State University · Raleigh, NC', bullets: [
        'Contributing to the redesign of the College of Engineering’s legacy event-logging website from PHP to a Laravel and Vue.js stack, improving usability and functionality for 85+ active users',
        'Applying and expanding web development skills in PHP, Laravel, JavaScript, HTML/CSS, and Vue.js',
        'Using Git/GitHub for version control, code reviews, and maintaining an organized development workflow'] },
      { what: 'IT Service Desk Student Technician', when: 'Dec 2024 – Sep 2025', where: 'North Carolina State University · Raleigh, NC', bullets: [
        'Provided technical support for students, staff, and faculty for the 9 departments of the College of Engineering',
        'Deployed and reimaged Windows systems using PXE boot, imaging tools, and secure data wipes',
        'Troubleshot software/hardware issues and managed tickets in ServiceNow'] },
      { what: 'Restaurant Team Member', when: 'May 2023 – Mar 2025', where: 'Chipotle · Morrisville, NC', bullets: [
        'Prepared and served meals for an average of 150+ customers per shift, ensuring consistent quality and presentation according to company standards',
        'Addressed guest needs quickly and courteously during high-volume shifts while adhering to food safety guidelines'] },
      { what: 'Cashier', when: 'Dec 2021 – Aug 2022', where: 'Taco Bell · Morrisville, NC', bullets: [
        'Took 100+ customer orders per shift accurately and processed cash and credit transactions using the point-of-sale system, and resolved complaints in front-of-house and drive-thru settings'] },
    ],
    activities: [
      { what: 'Member and Mentee', when: '2024 – Present', where: 'Women in Computer Science (WiCS)' },
      { what: 'Guatemala Water & Sanitation Project Team Member', when: '2025', where: 'Engineers Without Borders (EWB)' },
    ],
  },
};

// The Credits window. tests/credits.mjs checks `assets` and `fonts` against art/credits.md.
export const CREDITS = {
  inspiredBy: [
    { text: 'seanaiux.com/computer', href: 'https://seanaiux.com/computer' },
    { text: 'felixrieseberg.com', href: 'https://felixrieseberg.com' },
  ],
  assets: [
    { title: 'old computer', author: 'ivsn', license: 'CC BY 4.0', href: 'https://sketchfab.com/models/8183647717084f008969c22b7fcd1b8a' },
    { title: 'CRT Computer Monitor', author: 'fizyman', license: 'CC BY 4.0', href: 'https://sketchfab.com/3d-models/crt-computer-monitor-f2ff0013f86e4cd0a2aee183a23bdfee' },
    { title: 'Desk lamp', author: '7ASSAN', license: 'CC BY 4.0', href: 'https://sketchfab.com/models/b9458e04d30e4b6284d46d35880a9b95' },
    { title: 'Verbatim Floppy Disk 3.5"', author: 'Timescade', license: 'CC BY 4.0', href: 'https://sketchfab.com/models/f055312452cb4b5f87898a9beb312cbe' },
    { title: 'Ice Coffee', author: 'ponchoguy', license: 'CC BY 4.0', href: 'https://sketchfab.com/models/fd2e9142168d4f31ba99bf4d9b1165b4' },
    { title: 'Coffee Mug (School Project)', author: 'FrenchBaguette', license: 'CC BY 4.0', href: 'https://sketchfab.com/models/5f5ccee1514c440887c072fae8e0d699' },
  ],
  fonts: [
    { title: 'Atkinson Hyperlegible', author: 'Braille Institute', license: 'SIL OFL 1.1', href: 'https://brailleinstitute.org/freefont' },
    { title: 'Departure Mono', author: 'Helena Zhang', license: 'SIL OFL 1.1', href: 'https://departuremono.com' },
    { title: 'Playfair Display', author: 'Claus Eggers Sørensen', license: 'SIL OFL 1.1', href: 'https://fonts.google.com/specimen/Playfair+Display' },
    { title: 'Cinzel', author: 'Natanael Gama', license: 'SIL OFL 1.1', href: 'https://fonts.google.com/specimen/Cinzel' },
  ],
  builtWith: 'Built with Three.js and Blender.',
};

// The floppies on the desk: entry i is click_project_0{i+1} and label cell i. `window` is a
// screen window id (projects, about, resume, contact); `card` selects a project in it.
export const FLOPPIES = [
  ...CONTENT.projects.map(({ id, title, name }) => ({ title, label: name, window: 'projects', card: id })),
  { title: 'RESUME', label: 'Resume', window: 'resume' },
  { title: 'ABOUT', label: 'About', window: 'about' },
  { title: 'CONTACT', label: 'Contact', window: 'contact' },
];

// Every word the room itself says (labels, hints, buttons, the intro), in one place to edit.
export const UI = {
  introCta: 'click me',
  hint: 'drag to look around · click things on the desk',
  back: 'back to desk',
  menu: 'menu',
  credits: 'credits',
  objects: { crt: 'use computer', lamp: 'lamp', treehouse: 'cherry blossom treehouse' },
  menuItems: [['about', 'About'], ['projects', 'Projects'], ['resume', 'Resume'], ['contact', 'Contact'], ['credits', 'Credits']],
};
