# Linka Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a product landing page for linka.zone

**Architecture:** React + Vite SPA, built to static files, served by Nginx alongside existing MCP service

**Tech Stack:** React 19, TypeScript, Vite, pnpm

---

### Task 1: Scaffold React + Vite project

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/index.html`
- Create: `web/src/main.tsx`

- [ ] **Step 1: Create project with pnpm**

```bash
cd /Users/hugo/Desktop/Linka/.claude/worktrees/admiring-germain
mkdir -p web/src/components web/public
cd web
pnpm init
pnpm add react react-dom
pnpm add -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

- [ ] **Step 2: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Linka — 让每场活动，都变成人脉引擎</title>
  <meta name="description" content="AI 驱动的线下活动社交网络。精准发现、自动沉淀、实时激活你的人脉。" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './App.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold React + Vite project"
```

### Task 2: Global styles (App.css)

**Files:**
- Create: `web/src/App.css`

- [ ] **Step 1: Write global CSS**

Full CSS with:
- CSS reset / base styles
- System font stack with Chinese font support
- Color variables: --orange (#e67e22), --purple (#7c6aff), --bg (#faf8f5), --text (#2c3e50)
- Section spacing, responsive breakpoints
- Code block styling for Hero
- FAQ accordion styles
- Mobile responsive (single column under 768px)

- [ ] **Step 2: Commit**

### Task 3: Hero component

**Files:**
- Create: `web/src/components/Hero.tsx`

- [ ] **Step 1: Build Hero with slogan + code block + copy button**

Content:
- Brand: LINKA
- Slogan: 让每场活动，都变成人脉引擎
- Subtitle: 精准发现 · 自动沉淀 · 实时激活
- MCP config code block with copy-to-clipboard button
- Helper text: 添加到你的 AI 助手配置中，即刻开始

- [ ] **Step 2: Commit**

### Task 4: ValueProps component

**Files:**
- Create: `web/src/components/ValueProps.tsx`

- [ ] **Step 1: Build three-column value cards**

Cards: 🎯 精准发现 / 💎 自动沉淀 / 🔄 实时画像

- [ ] **Step 2: Commit**

### Task 5: Perspectives component

**Files:**
- Create: `web/src/components/Perspectives.tsx`

- [ ] **Step 1: Build dual-perspective section**

Two cards side by side:
- 活动组织者 (orange top border, 4 value points about data-driven operations)
- 活动参与者 (purple top border, 4 value points about precise matching)

- [ ] **Step 2: Commit**

### Task 6: ChatDemo component

**Files:**
- Create: `web/src/components/ChatDemo.tsx`

- [ ] **Step 1: Build chat bubble demo**

Multi-turn conversation with user/AI bubbles showing join → match flow.

- [ ] **Step 2: Commit**

### Task 7: FAQ component

**Files:**
- Create: `web/src/components/FAQ.tsx`

- [ ] **Step 1: Build accordion FAQ**

4 items with click-to-expand. useState for open state.

Questions: 什么是 MCP / 需要下载 App 吗 / 数据安全 / 支持哪些 AI 助手

- [ ] **Step 2: Commit**

### Task 8: Footer component

**Files:**
- Create: `web/src/components/Footer.tsx`

- [ ] **Step 1: Build footer**

Linka brand, GitHub link, contact, copyright.

- [ ] **Step 2: Commit**

### Task 9: App.tsx — assemble all components

**Files:**
- Create: `web/src/App.tsx`

- [ ] **Step 1: Import and compose all sections**

```tsx
import Hero from './components/Hero'
import ValueProps from './components/ValueProps'
import Perspectives from './components/Perspectives'
import ChatDemo from './components/ChatDemo'
import FAQ from './components/FAQ'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <Hero />
      <ValueProps />
      <Perspectives />
      <ChatDemo />
      <FAQ />
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Verify dev server runs**

```bash
cd web && pnpm dev
```

- [ ] **Step 3: Commit**

### Task 10: Build and deploy

**Files:**
- Modify: server `/etc/nginx/sites-available/linka`

- [ ] **Step 1: Build production bundle**

```bash
cd web && pnpm build
```

- [ ] **Step 2: Upload dist to server**

```bash
scp -r dist/* root@123.56.163.63:/var/www/linka/
```

- [ ] **Step 3: Update Nginx config**

Update to serve static files at `/` and proxy `/mcp` + `/health` to Hono.

- [ ] **Step 4: Reload Nginx and verify**

```bash
ssh root@123.56.163.63 "nginx -t && systemctl reload nginx"
curl -s https://linka.zone/ | head -5
curl -s https://linka.zone/health
```

- [ ] **Step 5: Commit**
