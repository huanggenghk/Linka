# Hero 实时统计 + 人脉滚动条

## 概述

在 Hero 区域底部新增两个元素：实时统计指示器和人脉信息滚动条（Ticker），增强社会证明感和平台活跃度感知。

## 后端

### `GET /api/stats`

新增 REST endpoint，查询 `events` 和 `agents` 表的 count。

**响应：**
```json
{ "events": 12, "agents": 48 }
```

**实现：**
- 在 `src/app.ts` 的 Hono app 中新增路由
- 用 Drizzle `count()` 查询两张表
- 无鉴权（公开数据）

## 前端

### 1. 状态指示器

Hero CTA 按钮下方，两行垂直排列：

```
🟢 12 场活动正在运行
🟢 48 个 Agent 已接入
```

- 绿点：`#2D9F6F`（DESIGN.md success 色），CSS `pulse` 动画实现呼吸闪烁
- 文字：`--text-secondary`，DM Sans，sm 字号
- 页面加载时 fetch `/api/stats`，loading 期间不渲染（避免布局跳动）
- fetch 失败时静默隐藏整个模块

### 2. 人脉滚动条（Ticker）

状态指示器下方，全宽横幅，mock 数据卡片从右向左无限滚动。

**卡片格式：** `昵称 · 公司 · 关注方向/寻找`

**Mock 数据（硬编码）：**
1. Kira · Moonshot AI · 关注多模态落地，寻找产品端合作伙伴
2. Vincent · 红杉中国 · 关注AI Infra赛道，寻找种子轮项目
3. 0xNova · 字节跳动 · 关注端侧推理优化，寻找算法方向交流
4. Mia · 智谱AI · 关注Agent框架设计，寻找开源社区贡献者
5. hyperZ · 阿里云 · 关注Serverless AI，寻找企业级落地场景
6. Ethan · 真格基金 · 关注开发者工具，寻找技术型创始人
7. Coco · 小红书 · 关注推荐系统优化，寻找算法团队交流
8. Rex · DeepSeek · 关注大模型训练效率，寻找infra方向合作
9. Yuki · 蚂蚁集团 · 关注隐私计算，寻找跨机构数据合作
10. Neo · 独立开发者 · 关注AI Native应用，寻找产品共创伙伴

**样式：**
- 卡片：pill 形状，白色背景 + 细边框（`--border`），圆角 `--radius-full`
- 纯 CSS `@keyframes` + `translateX` 实现，不用 JS
- 两份相同内容首尾拼接实现无缝循环
- 速度平缓（约 35s 一轮）
- 容器 `overflow: hidden` 裁切

## 不做的事

- 不做数字滚动动画（DESIGN.md 规范：不做入场动画）
- 不做轮询/实时刷新（页面加载取一次）
- 不做 ticker hover 暂停
- 不做 ticker 点击交互
- 不从 API 获取人脉数据（纯 mock）
- 不做缓存/SSR

## 文件变更清单

| 文件 | 变更 |
|------|------|
| `src/app.ts` | 新增 `GET /api/stats` 路由 |
| `web/src/components/Hero.tsx` | 新增统计指示器 + Ticker |
| `web/src/App.css` | 新增脉冲动画、ticker 滚动样式 |
