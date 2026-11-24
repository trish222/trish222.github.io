// Project cards, and the floppies on the desk that open them.

// `id` names the floppy's card; descriptions are placeholders until P8's content audit.
export const projects = [
  {
    id: "microlearning",
    title: "MICROLEARNING",
    name: "Microlearning",
    icon: "📱",
    tags: ["TypeScript", "Vue"],
    description:
      "Web application that helps users study through short, structured lessons, visuals, audio learning, writing practice, exercises, and quizzes.",
  },
  {
    id: "moneyflow",
    title: "MONEYFLOW",
    name: "MoneyFlow",
    icon: "💻",
    tags: ["React", "Node.js", "PostgreSQL"],
    description:
      "In the works: A web app built with React and Node.js. A financial dashboard that is all inclusive so I can look at my savings, budget, investments all in one place.",
  },
  {
    id: "cook",
    title: "COOK",
    name: "Cook",
    icon: "🌐",
    tags: ["Python", "Flask"],
    description: "In the works: my personal recipe generator.",
  },
];

// The floppies on the desk: entry i is click_project_0{i+1} and label cell i. `window` is a
// screen window id (projects, about, resume, contact); `card` selects a project in it.
export const FLOPPIES = [
  ...projects.map(({ id, title, name }) => ({
    title,
    label: name,
    window: "projects",
    card: id,
  })),
  { title: "RESUME", label: "Resume", window: "resume" },
  { title: "ABOUT", label: "About", window: "about" },
  { title: "CONTACT", label: "Contact", window: "contact" },
];
