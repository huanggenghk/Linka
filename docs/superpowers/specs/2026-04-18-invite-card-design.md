# 邀请卡片设计规格 V1

## 概述

`create_event` MCP 工具在活动创建后返回一张邀请卡片图片（PNG），包含活动信息和二维码，供 AI Agent 直接展示在对话界面中。

## 视觉设计

### 风格
深色玻璃拟态（Dark Glassmorphism）。卡片本身极薄透明，依靠背景光球（ambient orbs）产生通透感。

### 尺寸
- 宽：480px，高：约 297px（黄金比例 1.618:1）
- 输出格式：PNG，不含背景（卡片本身有圆角 + 边框）

### 颜色
- 卡片背景：`rgba(255,255,255,0.04)` + `backdrop-filter: blur(28px) saturate(160%)`
- 卡片边框：`rgba(255,255,255,0.1)`
- 顶部高光线：白色渐变 `rgba(255,255,255,0.5)`
- 事件名称：`rgba(255,252,244,0.92)`
- Meta 字段 key：`rgba(194,139,62,0.7)`（琥珀金）
- Meta 字段 value：`rgba(255,240,210,0.38)`
- 分割线：`rgba(255,255,255,0.12)`
- Footer 背景：`rgba(0,0,0,0.15)`
- Footer 分隔线：`rgba(255,255,255,0.07)`
- CTA title：`#C28B3E`（琥珀金）
- CTA subtitle：`rgba(255,240,210,0.3)`
- LINKA 品牌：`#C28B3E`
- linka.zone：`rgba(255,255,255,0.18)`

### 字体
- 标题（事件名）：Satoshi 900，20px
- Meta key：JetBrains Mono，9px
- Meta value：JetBrains Mono，11px
- CTA title：Satoshi 700，13px
- CTA subtitle：DM Sans，11px
- 品牌名：Satoshi 700，13px，letter-spacing 0.16em

## 布局结构

```
┌─────────────────────────────────────────────────────┐  ← 顶部高光线
│                                                     │
│  [事件名称 · 大字]          [QR 码 128×128px]        │
│  AI Builder Meetup                                  │
│  Shanghai · S03                                     │
│                                                     │
│  DATE  2026-04-25 · 周六                            │
│  LOC   徐汇区 · 望星楼                               │
│                                                     │
├─────────────────────────────────────────────────────┤  ← 分隔线
│  发给 Agent，接入 Linka          LINKA               │  ← Footer
│  在 Agent 网络中高效链接现场人脉   linka.zone         │
└─────────────────────────────────────────────────────┘
```

- 左右两栏由竖向分割线隔开（`rgba(255,255,255,0.12)`）
- 左栏：flex-direction column，事件名 + meta
- 右栏：QR 码居中，白色背景圆角框
- Footer：横向 flex，CTA 在左，品牌在右

## 数据字段

| 字段 | 来源 | 展示 |
|------|------|------|
| 事件名称 | event.name | 最多 2 行，超出截断 |
| 日期 | event.date | 格式：YYYY-MM-DD · 周X |
| 地点 | event.location | 纯文本 |
| 二维码 | `${BASE_URL}/join/${inviteCode}` | 128×128px，白底黑码 |

## 技术实现

### 依赖
- `satori`：JSX → SVG（零 native 依赖）
- `@resvg/resvg-js`：SVG → PNG（WASM，Docker 兼容）
- `qrcode`：已安装，生成二维码 SVG 字符串

### 返回格式
MCP image content block：
```typescript
{
  type: "image",
  data: base64EncodedPng,
  mimeType: "image/png"
}
```

### 模块位置
`src/mcp/card.ts` — 导出 `generateInviteCard(event, inviteCode): Promise<Buffer>`

### 字体加载
Satori 需要字体 ArrayBuffer。从本地文件或 CDN 加载 Satoshi / DM Sans / JetBrains Mono。字体文件放在 `src/assets/fonts/`。

## 验证标准
- [ ] 生成的 PNG 宽 480px，高约 297px
- [ ] QR 码可被手机扫描识别
- [ ] Claude Desktop / 飞书 aily 等 Agent 界面能内联展示图片
- [ ] Docker 构建不报 native 依赖错误
