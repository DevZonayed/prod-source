export type FrameworkTemplate = {
  id: string;
  name: string;
  description: string;
  templateRepo: string;
  devCommand: (port: number) => string;
  installCommand: string;
  defaultPort: number;
};

export const FRAMEWORK_TEMPLATES: Record<string, FrameworkTemplate> = {
  nextjs: {
    id: "nextjs",
    name: "Next.js",
    description: "Next.js with App Router, Tailwind CSS, and shadcn/ui",
    templateRepo: "https://github.com/DevZonayed/freestyle-base-nextjs-shadcn",
    devCommand: (port: number) => `npx next dev --turbopack --port ${port}`,
    installCommand: "npm install",
    defaultPort: 3000,
  },
  react: {
    id: "react",
    name: "React (Vite)",
    description: "React with Vite, TypeScript, and Tailwind CSS",
    templateRepo: "",
    devCommand: (port: number) => `npx vite --port ${port} --host`,
    installCommand: "npm install",
    defaultPort: 5173,
  },
};

export function getTemplate(framework: string): FrameworkTemplate | null {
  return FRAMEWORK_TEMPLATES[framework] ?? null;
}

export function listTemplates(): FrameworkTemplate[] {
  return Object.values(FRAMEWORK_TEMPLATES);
}

export function getDevCommand(framework: string, port: number): string {
  const template = getTemplate(framework);
  if (!template) {
    // Fallback: generic npm run dev
    return `npm run dev -- --port ${port}`;
  }
  return template.devCommand(port);
}
