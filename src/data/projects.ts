export interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  tags: string[];
  links: {
    demo?: string;
    github?: string;
    case?: string;
  };
}

export const projectsData: Project[] = [
  {
    id: "1",
    title: "Project One",
    description:
      "A brief description of your first project. Share what problem it solved, what you built, and what you learned.",
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop",
    tags: ["React", "TypeScript", "Tailwind CSS"],
    links: {
      demo: "#",
      github: "#",
    },
  },
  {
    id: "2",
    title: "Project Two",
    description:
      "Describe your second significant project. Highlight the technical challenges you overcame and the impact it had.",
    image: "https://images.unsplash.com/photo-1633356122544-f134324ef6db?w=600&h=400&fit=crop",
    tags: ["Node.js", "MongoDB", "REST API"],
    links: {
      demo: "#",
      github: "#",
    },
  },
  {
    id: "3",
    title: "Project Three",
    description:
      "Your third project showcase. Include details about your role, the technologies used, and outcomes or metrics.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
    tags: ["Full-Stack", "Accessibility", "UX Design"],
    links: {
      demo: "#",
      github: "#",
    },
  },
  {
    id: "4",
    title: "Project Four",
    description:
      "Share another project that demonstrates your skills. This could be an open-source contribution, freelance work, or side project.",
    image: "https://images.unsplash.com/photo-1517694712506-a4a12b83b878?w=600&h=400&fit=crop",
    tags: ["JavaScript", "Performance", "Optimization"],
    links: {
      github: "#",
    },
  },
];
