import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, watchFile } from "fs";
import type { Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Reads theme.json and returns shadcn/ui-compatible CSS custom properties.
 * Replaces @replit/vite-plugin-shadcn-theme-json.
 */
function buildThemeCSS(): string {
  let theme: { variant?: string; primary?: string; appearance?: string; radius?: number };
  try {
    theme = JSON.parse(readFileSync(path.resolve(__dirname, "theme.json"), "utf-8"));
  } catch {
    theme = { primary: "hsl(260, 80%, 50%)", appearance: "dark", radius: 0.5 };
  }

  // Extract HSL components from "hsl(H, S%, L%)" or "hsl(H S% L%)"
  const hslMatch = (theme.primary ?? "hsl(260, 80%, 50%)")
    .replace(/hsl\(/, "")
    .replace(/\)/, "")
    .split(/[\s,]+/)
    .map((v) => v.trim());
  const [h, s, l] = hslMatch;
  const primary = `${h} ${s} ${l}`;
  const radius = `${theme.radius ?? 0.5}rem`;
  const isDark = (theme.appearance ?? "dark") !== "light";

  const darkVars = `
  --background: 222 47% 7%;
  --foreground: 210 40% 98%;
  --card: 222 47% 10%;
  --card-foreground: 210 40% 98%;
  --popover: 222 47% 10%;
  --popover-foreground: 210 40% 98%;
  --primary: ${primary};
  --primary-foreground: 210 40% 98%;
  --secondary: 217 33% 17%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --accent: ${h} 60% 30%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 63% 31%;
  --destructive-foreground: 210 40% 98%;
  --border: 217 33% 17%;
  --input: 217 33% 17%;
  --ring: ${primary};
  --radius: ${radius};
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
  --sidebar-background: 220 47% 5%;
  --sidebar-foreground: 240 5% 96%;
  --sidebar-primary: ${primary};
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: ${h} 30% 20%;
  --sidebar-accent-foreground: 240 5% 96%;
  --sidebar-border: 220 13% 15%;
  --sidebar-ring: ${primary};`;

  const lightVars = `
  --background: 0 0% 100%;
  --foreground: 222 84% 5%;
  --card: 0 0% 100%;
  --card-foreground: 222 84% 5%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 84% 5%;
  --primary: ${primary};
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 210 40% 96%;
  --accent-foreground: 222 47% 11%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: ${primary};
  --radius: ${radius};
  --chart-1: 12 76% 61%;
  --chart-2: 173 58% 39%;
  --chart-3: 197 37% 24%;
  --chart-4: 43 74% 66%;
  --chart-5: 27 87% 67%;
  --sidebar-background: 0 0% 98%;
  --sidebar-foreground: 240 5% 26%;
  --sidebar-primary: ${primary};
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 240 5% 96%;
  --sidebar-accent-foreground: 240 6% 10%;
  --sidebar-border: 220 13% 91%;
  --sidebar-ring: ${primary};`;

  if (isDark) {
    return `:root, .dark {${darkVars}\n}\n.light {${lightVars}\n}`;
  }
  return `:root, .light {${lightVars}\n}\n.dark {${darkVars}\n}`;
}

/**
 * Vite plugin that injects shadcn/ui CSS variables derived from theme.json.
 * Replaces @replit/vite-plugin-shadcn-theme-json.
 */
function themeJsonPlugin(): Plugin {
  const virtualModuleId = "virtual:theme-vars";
  const resolvedId = "\0" + virtualModuleId;

  return {
    name: "vite-plugin-theme-json",
    resolveId(id) {
      if (id === virtualModuleId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) return ``;
    },
    transformIndexHtml() {
      return [
        {
          tag: "style",
          attrs: { id: "shadcn-theme-vars" },
          children: buildThemeCSS(),
          injectTo: "head-prepend",
        },
      ];
    },
    configureServer(server) {
      const themeFile = path.resolve(__dirname, "theme.json");
      watchFile(themeFile, () => {
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    themeJsonPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
