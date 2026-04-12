import { useState } from 'react'

const mcpConfig = `{
  "mcpServers": {
    "linka": {
      "url": "https://linka.zone/mcp"
    }
  }
}`

export default function Hero() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(mcpConfig)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="hero">
      <div className="hero-brand">LINKA</div>
      <h1 className="hero-slogan">让每场活动，都变成人脉引擎</h1>
      <p className="hero-subtitle">精准发现 · 自动沉淀 · 实时激活</p>

      <div className="hero-code-wrapper">
        <div className="hero-code">
          <button className="copy-btn" onClick={handleCopy}>
            {copied ? '已复制' : '复制'}
          </button>
          <div><span className="bracket">{'{'}</span></div>
          <div>  <span className="key">"mcpServers"</span>: {'{'}</div>
          <div>    <span className="key">"linka"</span>: {'{'}</div>
          <div>      <span className="key">"url"</span>: <span className="value">"https://linka.zone/mcp"</span></div>
          <div>    {'}'}</div>
          <div>  {'}'}</div>
          <div><span className="bracket">{'}'}</span></div>
        </div>
        <p className="hero-helper">添加到你的 AI 助手配置中，即刻开始</p>
      </div>
    </section>
  )
}
