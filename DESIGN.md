# Design System — Linka

## Product Context
- **What this is:** AI Agent 驱动的线下活动社交网络平台，通过 MCP 协议让 AI 助手帮用户发现和建立人脉
- **Who it's for:** 中国科技/AI 圈子的活动组织者和参会者
- **Space/industry:** Event networking, AI tools, developer tools
- **Project type:** Landing page + MCP backend

## Aesthetic Direction
- **Direction:** Editorial/Industrial — 开发者工具的品味感，类似 Linear/Vercel
- **Decoration level:** Intentional — 微妙背景纹理（细点阵或网格），不花哨
- **Mood:** 克制、高级、专业但温暖。像一个认真做设计的技术团队，不是消费级好玩也不是企业级沉闷
- **Reference sites:** lu.ma, brella.io, grip.events, linear.app, vercel.com

## Typography
- **Display/Hero:** Satoshi (weight 700-900) — 几何感、现代、有辨识度
- **Body:** DM Sans (weight 400-600) — 干净、可读性佳、与 Satoshi 配合和谐
- **UI/Labels:** DM Sans (weight 600)
- **Data/Tables:** DM Sans (tabular-nums)
- **Code:** JetBrains Mono (weight 400-500)
- **Chinese fallback:** -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif
- **Loading:** Bunny Fonts CDN (GDPR-friendly alternative to Google Fonts)
- **Scale:**
  - xs: 12px / 0.75rem
  - sm: 13px / 0.8125rem
  - base: 15px / 0.9375rem
  - md: 16px / 1rem
  - lg: 18px / 1.125rem
  - xl: 24px / 1.5rem
  - 2xl: 28px / 1.75rem
  - 3xl: 36px / 2.25rem
  - 4xl: 44px / 2.75rem
  - hero: 48px / 3rem

## Color
- **Approach:** Restrained — 单一强调色 + 中性色，色彩稀少但精准
- **Primary:** #C28B3E (Amber Gold) — 温暖、高级、在 AI 工具的蓝紫色海洋里独特。"链接"的隐喻，金色链条
- **Primary hover:** #A87832
- **Primary light:** #F5EBD9 — 用于浅色背景、高亮区域
- **Background:** #FAFAF8 (微暖白)
- **Surface:** #FFFFFF (卡片、弹窗)
- **Text primary:** #1A1A1A (接近纯黑)
- **Text secondary:** #6B6B6B
- **Text muted:** #999999
- **Border:** #E8E8E5
- **Border hover:** #D0D0CC
- **Semantic:**
  - success: #2D9F6F / bg: #EDF7F2
  - warning: #D4943A / bg: #FEF6EC
  - error: #D45A5A / bg: #FDEEED
  - info: #4A8FD4 / bg: #EDF4FC
- **Dark mode strategy:**
  - Background: #0F0F0F
  - Surface: #1A1A1A
  - Text: #ECECEC
  - Primary: #D4A04A (略亮以保证对比度)
  - Border: #2A2A2A
  - 语义色背景降饱和度

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — 让内容呼吸
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined — 严格对齐，可预测的视觉节奏
- **Structure:** 组织者和参会者分成两个独立模块，上下排列，各自居中展示
- **Hero:** 价值导向，不放代码块。直接告诉用户能得到什么
- **Max content width:** 960px
- **Border radius:** sm: 4px, md: 8px, lg: 12px, full: 9999px (pills/badges)
- **Card shadow:** 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)
- **Card shadow hover:** 0 4px 12px rgba(0,0,0,0.08)
- **Background decoration:** 细点阵纹理 (radial-gradient dots, 24px grid, low opacity)

## Motion
- **Approach:** Minimal-functional — 只做有意义的状态过渡
- **Easing:** enter: ease-out, exit: ease-in, move: ease-in-out
- **Duration:** micro: 50-100ms, short: 150-250ms, medium: 250-400ms
- **Use cases:** hover 反馈、输入框 focus、主题切换过渡。不做滚动动画、不做入场动画

## Chat UI Direction
- **User messages:** 左侧，amber 头像，白色气泡 + 边框
- **AI messages:** 右侧，深色头像，amber-light 背景气泡
- **Match cards:** 右侧对齐（跟 AI 回复同侧），左侧 amber 边框强调

## Anti-patterns (never use)
- Purple/violet gradients as accent
- Orange + purple dual color scheme for role differentiation
- Code blocks as hero CTA
- System fonts without loaded display fonts
- Decorative blobs or gradient backgrounds
- Uniform bubbly border-radius on all elements

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-12 | Initial design system created | Based on competitive research (Luma, Brella, Grip) + first-principles analysis |
| 2026-04-12 | Amber gold #C28B3E as primary | Unique in AI tool space (sea of blue/purple), warm, "link/chain" metaphor |
| 2026-04-12 | Satoshi + DM Sans typography | Geometric modern display + clean readable body, both distinctive without being quirky |
| 2026-04-12 | Hero: value-first, no code block | Users care about what they get, not JSON config. Code block moved to docs/FAQ |
| 2026-04-12 | Organizer/Attendee as separate modules | Each role gets its own focused section instead of side-by-side split |
| 2026-04-12 | User left, AI right in chat UI | Natural reading flow: user initiates on left, AI responds on right |
