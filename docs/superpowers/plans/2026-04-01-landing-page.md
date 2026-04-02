# Landing Page Croma Print — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma landing page standalone (APP-Landing/) para a Croma Print com React 19 + Vite + Tailwind CSS, formulário de contato integrado ao Supabase, e botão WhatsApp flutuante.

**Architecture:** App Vite standalone em APP-Landing/, mesma estrutura do APP-Campo. Página única (SPA sem roteamento) com 8 seções. Formulário envia lead direto via REST para Supabase. Sem imagens externas — apenas SVG inline, gradientes CSS e ícones Lucide.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Lucide React, Sonner (toasts)

---

## Mapa de Arquivos

```
APP-Landing/
  package.json
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  postcss.config.js
  index.html
  vercel.json
  .gitignore
  src/
    main.tsx
    App.tsx
    globals.css
    vite-env.d.ts
    components/
      Navbar.tsx          — Barra de navegação com logo + CTA WhatsApp
      Hero.tsx            — Seção hero com headline + 2 CTAs
      Servicos.tsx        — Cards de serviços com ícones Lucide
      Portfolio.tsx       — Grid de placeholders com gradientes
      Clientes.tsx        — Logos de clientes em texto estilizado
      Sobre.tsx           — Info da empresa em 2 colunas
      ComoFunciona.tsx    — 4 passos visuais
      CTAFinal.tsx        — CTA grande + formulário de contato
      Footer.tsx          — Rodapé com dados da empresa
      WhatsAppButton.tsx  — Botão flutuante fixo
      ContactForm.tsx     — Formulário com envio ao Supabase
```

---

## Task 1: Scaffolding — package.json, configs, index.html

**Files:**
- Create: `APP-Landing/package.json`
- Create: `APP-Landing/vite.config.ts`
- Create: `APP-Landing/tailwind.config.ts`
- Create: `APP-Landing/postcss.config.js`
- Create: `APP-Landing/tsconfig.json`
- Create: `APP-Landing/tsconfig.app.json`
- Create: `APP-Landing/tsconfig.node.json`
- Create: `APP-Landing/index.html`
- Create: `APP-Landing/.gitignore`
- Create: `APP-Landing/vercel.json`

- [ ] **Step 1: Criar APP-Landing/package.json**

```json
{
  "name": "croma-landing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.462.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "sonner": "^1.5.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react-swc": "^3.5.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "~5.6.2",
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 2: Criar APP-Landing/vite.config.ts**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8081,
    host: "::",
  },
});
```

- [ ] **Step 3: Criar APP-Landing/tailwind.config.ts**

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        croma: {
          primary: "#1e40af",
          secondary: "#2563eb",
          hover: "#1d4ed8",
          light: "#dbeafe",
          dark: "#1e3a8a",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 4: Criar APP-Landing/postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Criar APP-Landing/tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 6: Criar APP-Landing/tsconfig.app.json**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Criar APP-Landing/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 8: Criar APP-Landing/index.html**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Fachadas em ACM, banners, material PDV, envelopamento veicular e letreiros para redes de lojas e franquias. Orçamento rápido por WhatsApp. Produção própria em SP."
    />
    <meta property="og:title" content="Croma Print - Comunicação Visual Profissional" />
    <meta
      property="og:description"
      content="Fachadas em ACM, banners, material PDV, envelopamento veicular e letreiros para redes de lojas e franquias."
    />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/og-image.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
      rel="stylesheet"
    />
    <title>Croma Print - Comunicação Visual Profissional | Fachadas, Banners, PDV</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Criar APP-Landing/.gitignore**

```
node_modules
dist
dist-ssr
*.local
.env
.env.local
```

- [ ] **Step 10: Criar APP-Landing/vercel.json**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }],
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite"
}
```

- [ ] **Step 11: Criar favicon SVG em APP-Landing/public/favicon.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#1e40af"/>
  <text x="16" y="22" font-family="Inter,sans-serif" font-size="18" font-weight="900" fill="white" text-anchor="middle">C</text>
</svg>
```

- [ ] **Step 12: Commit**

```bash
cd "C:\Users\Caldera\Claude\CRM-Croma"
git add APP-Landing/
git commit -m "feat(landing): scaffold APP-Landing — configs, package.json, index.html"
```

---

## Task 2: Entrypoint — main.tsx, globals.css, App.tsx

**Files:**
- Create: `APP-Landing/src/main.tsx`
- Create: `APP-Landing/src/globals.css`
- Create: `APP-Landing/src/vite-env.d.ts`
- Create: `APP-Landing/src/App.tsx`

- [ ] **Step 1: Criar APP-Landing/src/vite-env.d.ts**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 2: Criar APP-Landing/src/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: "Inter", sans-serif;
  color: #1e293b;
  background: #ffffff;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 3: Criar APP-Landing/src/main.tsx**

```tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 4: Criar APP-Landing/src/App.tsx (estrutura com todas as seções)**

```tsx
import { Toaster } from "sonner";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Servicos from "./components/Servicos";
import Portfolio from "./components/Portfolio";
import Clientes from "./components/Clientes";
import Sobre from "./components/Sobre";
import ComoFunciona from "./components/ComoFunciona";
import CTAFinal from "./components/CTAFinal";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Toaster position="top-center" richColors />
      <Navbar />
      <main>
        <Hero />
        <Servicos />
        <Portfolio />
        <Clientes />
        <Sobre />
        <ComoFunciona />
        <CTAFinal />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Caldera\Claude\CRM-Croma"
git add APP-Landing/src/
git commit -m "feat(landing): entrypoint — main.tsx, App.tsx, globals.css"
```

---

## Task 3: Navbar e Hero

**Files:**
- Create: `APP-Landing/src/components/Navbar.tsx`
- Create: `APP-Landing/src/components/Hero.tsx`

- [ ] **Step 1: Criar Navbar.tsx**

```tsx
const WHATSAPP_URL =
  "https://wa.me/5511939471862?text=Ol%C3%A1!%20Vim%20pelo%20site%20e%20gostaria%20de%20um%20or%C3%A7amento.";

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-lg leading-none">C</span>
          </div>
          <div>
            <span className="font-bold text-slate-900 text-lg leading-none">Croma Print</span>
            <p className="text-xs text-slate-500 leading-none">Comunicação Visual</p>
          </div>
        </div>

        {/* CTA */}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Falar no WhatsApp
        </a>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Criar Hero.tsx**

```tsx
const WHATSAPP_URL =
  "https://wa.me/5511939471862?text=Ol%C3%A1!%20Vim%20pelo%20site%20e%20gostaria%20de%20um%20or%C3%A7amento.";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 overflow-hidden pt-16">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-300/10 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-500/30 border border-blue-400/50 text-blue-100 px-4 py-2 rounded-full text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Produção própria em São Paulo · Atendimento nacional
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-tight mb-6">
          Comunicação Visual
          <br />
          <span className="text-blue-200">Profissional</span>
          <br />
          para Sua Rede de Lojas
        </h1>

        <p className="text-xl sm:text-2xl text-blue-100 max-w-3xl mx-auto mb-10 leading-relaxed">
          Fachadas ACM, banners, material PDV, envelopamento e letreiros.
          <br />
          <strong className="text-white">Orçamento em minutos por WhatsApp ou IA.</strong>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all shadow-lg hover:shadow-green-500/30 hover:scale-105"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Pedir Orçamento no WhatsApp
          </a>

          <a
            href="#contato"
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all"
          >
            Pedir Orçamento Online
          </a>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
          {[
            { value: "307+", label: "Clientes atendidos" },
            { value: "15+", label: "Anos de experiência" },
            { value: "6", label: "Profissionais" },
            { value: "100%", label: "Produção própria" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-black text-white">{stat.value}</div>
              <div className="text-blue-200 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Caldera\Claude\CRM-Croma"
git add APP-Landing/src/components/
git commit -m "feat(landing): Navbar e Hero com CTA WhatsApp"
```

---

## Task 4: Serviços e Portfólio

**Files:**
- Create: `APP-Landing/src/components/Servicos.tsx`
- Create: `APP-Landing/src/components/Portfolio.tsx`

- [ ] **Step 1: Criar Servicos.tsx**

```tsx
import {
  Building2,
  ImageIcon,
  ShoppingBag,
  Car,
  Type,
  Navigation,
} from "lucide-react";

const servicos = [
  {
    icon: Building2,
    title: "Fachadas em ACM",
    desc: "Alumínio composto de alta durabilidade para fachadas de lojas e sedes corporativas com acabamento impecável.",
  },
  {
    icon: ImageIcon,
    title: "Banners e Impressão Digital",
    desc: "Grande formato com cores vibrantes — lona, adesivo, papel fotográfico e tecido para PDV e eventos.",
  },
  {
    icon: ShoppingBag,
    title: "Material PDV",
    desc: "Displays, wobblers, stoppers, banners de vitrine e todo material de ponto de venda para redes de lojas.",
  },
  {
    icon: Car,
    title: "Envelopamento Veicular",
    desc: "Adesivagem total ou parcial para frota corporativa com impressão de alta qualidade e durabilidade.",
  },
  {
    icon: Type,
    title: "Letreiros e Letras Caixa",
    desc: "Letras caixa iluminadas em LED, letras recortadas em ACM, acrílico e MDF para fachadas e interiores.",
  },
  {
    icon: Navigation,
    title: "Sinalização",
    desc: "Totens, placas, painéis e sistemas completos de sinalização para redes de lojas e espaços comerciais.",
  },
];

export default function Servicos() {
  return (
    <section id="servicos" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
            O que a Croma Print faz
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Soluções completas de comunicação visual para redes de lojas, franquias e indústria.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicos.map((s) => (
            <div
              key={s.title}
              className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all group"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <s.icon className="w-6 h-6 text-blue-700" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">{s.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Criar Portfolio.tsx**

```tsx
const portfolioItems = [
  { gradient: "from-blue-600 to-blue-800", label: "Fachada ACM — Rede de Calçados" },
  { gradient: "from-slate-600 to-slate-800", label: "Banner PDV — Rede de Moda" },
  { gradient: "from-blue-500 to-indigo-700", label: "Letreiro Caixa — Franquia" },
  { gradient: "from-blue-700 to-slate-700", label: "Envelopamento Veicular" },
  { gradient: "from-indigo-600 to-blue-800", label: "Fachada ACM — Varejo" },
  { gradient: "from-slate-500 to-blue-700", label: "Sinalização Corporativa" },
];

export default function Portfolio() {
  return (
    <section id="portfolio" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
            Nossos Trabalhos
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Projetos realizados para as maiores redes do varejo brasileiro.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolioItems.map((item, i) => (
            <div
              key={i}
              className={`relative h-64 rounded-2xl bg-gradient-to-br ${item.gradient} overflow-hidden group cursor-pointer`}
            >
              {/* Decorative SVG pattern */}
              <svg
                className="absolute inset-0 w-full h-full opacity-10"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <pattern id={`p${i}`} width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="1.5" fill="white" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#p${i})`} />
              </svg>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end">
                <div className="p-4 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-white font-semibold text-sm">{item.label}</p>
                </div>
              </div>

              {/* Center icon placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white/60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          * Fotos reais do portfólio em breve
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Caldera\Claude\CRM-Croma"
git add APP-Landing/src/components/Servicos.tsx APP-Landing/src/components/Portfolio.tsx
git commit -m "feat(landing): seções Serviços e Portfólio"
```

---

## Task 5: Clientes, Sobre e Como Funciona

**Files:**
- Create: `APP-Landing/src/components/Clientes.tsx`
- Create: `APP-Landing/src/components/Sobre.tsx`
- Create: `APP-Landing/src/components/ComoFunciona.tsx`

- [ ] **Step 1: Criar Clientes.tsx**

```tsx
const clientes = [
  { name: "Beira Rio", desc: "Rede de calçados" },
  { name: "Renner", desc: "Moda feminina" },
  { name: "Paquetá", desc: "Calçados e moda" },
];

export default function Clientes() {
  return (
    <section className="py-16 bg-slate-50 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-slate-500 text-sm font-medium uppercase tracking-wider mb-10">
          Empresas que confiam na Croma Print
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
          {clientes.map((c) => (
            <div
              key={c.name}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="bg-white border-2 border-slate-200 group-hover:border-blue-300 rounded-2xl px-8 py-4 transition-all">
                <span className="font-black text-xl sm:text-2xl text-slate-700 group-hover:text-blue-700 transition-colors tracking-tight">
                  {c.name}
                </span>
              </div>
              <span className="text-xs text-slate-400">{c.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Criar Sobre.tsx**

```tsx
import { Factory, MapPin, Users, Zap } from "lucide-react";

const diferenciais = [
  {
    icon: Factory,
    title: "Produção própria",
    desc: "Fábrica em São Paulo com maquinário moderno. Sem terceirização — mais qualidade e prazo.",
  },
  {
    icon: MapPin,
    title: "Atendimento nacional",
    desc: "Instalamos e entregamos em todo o Brasil para redes e franquias com operação nacional.",
  },
  {
    icon: Users,
    title: "Equipe especializada",
    desc: "6 profissionais com experiência em comunicação visual para grandes redes de varejo.",
  },
  {
    icon: Zap,
    title: "Orçamento por IA",
    desc: "Tecnologia própria gera orçamentos precisos em minutos via WhatsApp ou portal online.",
  },
];

export default function Sobre() {
  return (
    <section id="sobre" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-6">
              A Croma Print é especialista em redes de lojas
            </h2>
            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
              Há mais de 15 anos produzindo comunicação visual de alto padrão para os maiores
              varejistas do Brasil. Nossa fábrica em São Paulo garante qualidade, prazo e
              padronização para toda a sua rede.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Do briefing à instalação, cuidamos de todo o processo. Fachadas, banners, PDV,
              sinalização — tudo produzido internamente para garantir consistência visual em
              todas as unidades da sua rede.
            </p>
          </div>

          {/* Right — grid de diferenciais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {diferenciais.map((d) => (
              <div key={d.title} className="bg-slate-50 rounded-2xl p-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <d.icon className="w-5 h-5 text-blue-700" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{d.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Criar ComoFunciona.tsx**

```tsx
const passos = [
  {
    num: "01",
    title: "WhatsApp",
    desc: "Manda mensagem com o que precisa. Nossa IA ou equipe responde rapidinho.",
    color: "bg-green-500",
  },
  {
    num: "02",
    title: "Orçamento em Minutos",
    desc: "Recebe o orçamento detalhado com preço, prazo e arte prévia.",
    color: "bg-blue-600",
  },
  {
    num: "03",
    title: "Aprovação Online",
    desc: "Aprova pelo portal ou WhatsApp. Arte final enviada para validação.",
    color: "bg-blue-700",
  },
  {
    num: "04",
    title: "Produção e Instalação",
    desc: "Produzimos na nossa fábrica e instalamos em todo o Brasil.",
    color: "bg-blue-900",
  },
];

export default function ComoFunciona() {
  return (
    <section id="como-funciona" className="py-20 bg-blue-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Como funciona
          </h2>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            Do primeiro contato à instalação — processo simples, rápido e transparente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {passos.map((p, i) => (
            <div key={p.num} className="relative">
              {/* Connector line */}
              {i < passos.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-blue-700 z-0 -translate-x-1/2" />
              )}

              <div className="relative z-10 text-center">
                <div
                  className={`w-16 h-16 ${p.color} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}
                >
                  <span className="text-white font-black text-xl">{p.num}</span>
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{p.title}</h3>
                <p className="text-blue-200 text-sm leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Caldera\Claude\CRM-Croma"
git add APP-Landing/src/components/Clientes.tsx APP-Landing/src/components/Sobre.tsx APP-Landing/src/components/ComoFunciona.tsx
git commit -m "feat(landing): seções Clientes, Sobre e Como Funciona"
```

---

## Task 6: Formulário de Contato + CTA Final

**Files:**
- Create: `APP-Landing/src/components/ContactForm.tsx`
- Create: `APP-Landing/src/components/CTAFinal.tsx`

- [ ] **Step 1: Criar ContactForm.tsx**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

const SUPABASE_URL = "https://djwjmfgplnqyffdcgdaw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE";

interface FormData {
  contato_nome: string;
  email: string;
  empresa: string;
  telefone: string;
  observacoes: string;
}

const EMPTY: FormData = {
  contato_nome: "",
  email: "",
  empresa: "",
  telefone: "",
  observacoes: "",
};

export default function ContactForm() {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(false);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contato_nome || !form.telefone) {
      toast.error("Preencha pelo menos nome e telefone.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          contato_nome: form.contato_nome,
          email: form.email || null,
          empresa: form.empresa || null,
          telefone: form.telefone,
          observacoes: form.observacoes || null,
          origem: "landing_page",
          status: "novo",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      toast.success("Recebemos seu contato! Retornaremos em breve.");
      setForm(EMPTY);
    } catch {
      toast.error("Erro ao enviar. Tente pelo WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nome *
          </label>
          <input
            type="text"
            required
            value={form.contato_nome}
            onChange={(e) => set("contato_nome", e.target.value)}
            placeholder="Seu nome completo"
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Empresa
          </label>
          <input
            type="text"
            value={form.empresa}
            onChange={(e) => set("empresa", e.target.value)}
            placeholder="Nome da empresa"
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Telefone / WhatsApp *
          </label>
          <input
            type="tel"
            required
            value={form.telefone}
            onChange={(e) => set("telefone", e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="seu@email.com"
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          O que você precisa?
        </label>
        <textarea
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          placeholder="Ex: Fachada em ACM para 10 lojas, banners para PDV, envelopamento de frota..."
          rows={4}
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold px-6 py-4 rounded-2xl transition-colors text-lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Solicitar Orçamento
          </>
        )}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Criar CTAFinal.tsx**

```tsx
const WHATSAPP_URL =
  "https://wa.me/5511939471862?text=Ol%C3%A1!%20Vim%20pelo%20site%20e%20gostaria%20de%20um%20or%C3%A7amento.";

import ContactForm from "./ContactForm";

export default function CTAFinal() {
  return (
    <section id="contato" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left — CTA */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
              Pronto para transformar sua comunicação visual?
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Entre em contato agora. Orçamento gratuito, sem compromisso.
              Nossa equipe responde em minutos.
            </p>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-5 rounded-2xl text-xl transition-all shadow-lg hover:shadow-green-500/30 hover:scale-105 mb-8"
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Chamar no WhatsApp agora
            </a>

            <p className="text-slate-400 text-sm">
              Ou preencha o formulário ao lado e entraremos em contato.
            </p>
          </div>

          {/* Right — Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h3 className="font-bold text-slate-900 text-xl mb-6">
              Solicitar orçamento online
            </h3>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Caldera\Claude\CRM-Croma"
git add APP-Landing/src/components/ContactForm.tsx APP-Landing/src/components/CTAFinal.tsx
git commit -m "feat(landing): formulário de contato com integração Supabase + CTA Final"
```

---

## Task 7: Footer e WhatsApp Button

**Files:**
- Create: `APP-Landing/src/components/Footer.tsx`
- Create: `APP-Landing/src/components/WhatsAppButton.tsx`

- [ ] **Step 1: Criar Footer.tsx**

```tsx
const WHATSAPP_URL =
  "https://wa.me/5511939471862?text=Ol%C3%A1!%20Vim%20pelo%20site%20e%20gostaria%20de%20um%20or%C3%A7amento.";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-lg">C</span>
              </div>
              <span className="font-bold text-white text-lg">Croma Print</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Comunicação Visual Profissional para redes de lojas, franquias e indústria.
            </p>
          </div>

          {/* Contato */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contato</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  WhatsApp (11) 93947-1862
                </a>
              </li>
              <li>
                <a
                  href="mailto:junior@cromaprint.com.br"
                  className="hover:text-white transition-colors"
                >
                  junior@cromaprint.com.br
                </a>
              </li>
              <li className="text-slate-400">São Paulo, SP — Brasil</li>
            </ul>
          </div>

          {/* Serviços */}
          <div>
            <h4 className="font-semibold text-white mb-4">Serviços</h4>
            <ul className="space-y-2 text-sm">
              {[
                "Fachadas em ACM",
                "Banners e Impressão",
                "Material PDV",
                "Envelopamento Veicular",
                "Letreiros e Letras Caixa",
                "Sinalização",
              ].map((s) => (
                <li key={s} className="text-slate-400">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© 2024 Croma Print Comunicação Visual</p>
          <p>CNPJ 18.923.994/0001-83</p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Criar WhatsAppButton.tsx**

```tsx
const WHATSAPP_URL =
  "https://wa.me/5511939471862?text=Ol%C3%A1!%20Vim%20pelo%20site%20e%20gostaria%20de%20um%20or%C3%A7amento.";

export default function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir WhatsApp"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full shadow-lg hover:shadow-green-500/40 flex items-center justify-center transition-all hover:scale-110"
    >
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Caldera\Claude\CRM-Croma"
git add APP-Landing/src/components/Footer.tsx APP-Landing/src/components/WhatsAppButton.tsx
git commit -m "feat(landing): Footer e botão WhatsApp flutuante"
```

---

## Task 8: npm install + build verification

**Files:** nenhum novo — apenas verificação

- [ ] **Step 1: Instalar dependências**

```bash
cd "C:\Users\Caldera\Claude\CRM-Croma\APP-Landing"
npm install
```

Expected: sem erros, `node_modules/` criado.

- [ ] **Step 2: Rodar build**

```bash
npm run build
```

Expected: `dist/` criado, sem erros de TypeScript ou Vite.

- [ ] **Step 3: Se houver erro de TypeScript `noUnusedLocals`**

Verificar se algum import foi declarado mas não usado em algum componente. Remover o import.

- [ ] **Step 4: Commit final**

```bash
cd "C:\Users\Caldera\Claude\CRM-Croma"
git add APP-Landing/
git commit -m "feat(landing): landing page Croma Print — build OK, pronta para Vercel"
```

---

## Checklist de cobertura vs spec

| Requisito do spec | Task |
|---|---|
| Página única, mobile-first | T2 (Hero responsivo, meta viewport) |
| Hero com CTA WhatsApp + "Pedir Orçamento" | T3 Hero |
| Seção Serviços — 6 cards | T4 Servicos |
| Portfólio — grid com placeholders | T4 Portfolio |
| Clientes — Beira Rio, Renner, Paquetá | T5 Clientes |
| Sobre — produção própria, SP, 6 profissionais | T5 Sobre |
| Como Funciona — 4 passos | T5 ComoFunciona |
| CTA final + formulário | T6 CTAFinal + ContactForm |
| Footer com CNPJ, email, WhatsApp | T7 Footer |
| Botão WhatsApp flutuante | T7 WhatsAppButton |
| Formulário → Supabase REST leads | T6 ContactForm |
| Toast de sucesso/erro | T6 ContactForm (sonner) |
| Link WhatsApp wa.me correto | T3/T6/T7 |
| Inter (Google Fonts) | T2 index.html |
| Cores Croma (#1e40af etc.) | T1 tailwind.config |
| SEO title + meta description + OG | T2 index.html |
| favicon SVG | T1 |
| vercel.json | T1 |
| Sem imagens externas | T4 Portfolio (gradientes/SVG) |
| build funciona | T8 |
