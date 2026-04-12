export default function Hero() {
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
    </section>
  )
}
