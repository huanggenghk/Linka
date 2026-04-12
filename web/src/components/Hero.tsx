import { useState, useEffect } from 'react'

const TICKER_DATA = [
  { name: 'Kira', org: 'Moonshot AI', focus: '关注多模态落地，寻找产品端合作伙伴' },
  { name: 'Vincent', org: '红杉中国', focus: '关注AI Infra赛道，寻找种子轮项目' },
  { name: '0xNova', org: '字节跳动', focus: '关注端侧推理优化，寻找算法方向交流' },
  { name: 'Mia', org: '智谱AI', focus: '关注Agent框架设计，寻找开源社区贡献者' },
  { name: 'hyperZ', org: '阿里云', focus: '关注Serverless AI，寻找企业级落地场景' },
  { name: 'Ethan', org: '真格基金', focus: '关注开发者工具，寻找技术型创始人' },
  { name: 'Coco', org: '小红书', focus: '关注推荐系统优化，寻找算法团队交流' },
  { name: 'Rex', org: 'DeepSeek', focus: '关注大模型训练效率，寻找infra方向合作' },
  { name: 'Yuki', org: '蚂蚁集团', focus: '关注隐私计算，寻找跨机构数据合作' },
  { name: 'Neo', org: '独立开发者', focus: '关注AI Native应用，寻找产品共创伙伴' },
]

export default function Hero() {
  const [stats, setStats] = useState<{ events: number; agents: number } | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  return (
    <section className="hero">
      <div className="hero-brand">LINKA</div>
      <h1 className="hero-slogan">让每场活动，都变成人脉引擎</h1>
      <p className="hero-subtitle">
        AI 帮你发现现场最值得认识的人。无需下载 App，和你的 AI 助手说一句话就能加入。
      </p>
      <a className="hero-cta" href="#showcase">
        了解如何接入
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </a>
      <p className="hero-helper">支持 Claude Desktop / 飞书 aily / QClaw 等 MCP 客户端</p>

      {stats && (
        <div className="hero-stats">
          <span className="hero-stat-line">
            <span className="pulse-dot" />
            {stats.events} 场活动正在运行
          </span>
          <span className="hero-stat-line">
            <span className="pulse-dot" />
            {stats.agents} 个 Agent 已接入
          </span>
        </div>
      )}

      <div className="hero-ticker">
        <div className="hero-ticker-track">
          {[...TICKER_DATA, ...TICKER_DATA].map((item, i) => (
            <span className="hero-ticker-card" key={i}>
              <span className="hero-ticker-name">{item.name}</span>
              <span className="hero-ticker-sep">·</span>
              {item.org}
              <span className="hero-ticker-sep">·</span>
              {item.focus}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
