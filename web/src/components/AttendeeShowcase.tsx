const matches = [
  {
    name: '张明',
    title: '全栈工程师 · 前阿里',
    avatar: '👨‍💻',
    avatarBg: '#e8f8f0',
    matchPct: 96,
    matchColor: '#27ae60',
    matchBg: '#e8f8f0',
    borderColor: '#27ae60',
    desc: '专注 AI Agent 基础设施，正在寻找有产品思维的合伙人，一起做企业级 Agent 平台',
    contact: '微信：zhangming_dev',
  },
  {
    name: '李然',
    title: '后端架构师 · 前字节',
    avatar: '👩‍💻',
    avatarBg: '#fff5eb',
    matchPct: 91,
    matchColor: '#e67e22',
    matchBg: '#fff5eb',
    borderColor: '#e67e22',
    desc: '对 MCP 生态深度研究，想找技术合伙人做开发者工具方向的创业',
    contact: '微信：liran_arch',
  },
  {
    name: '王飞',
    title: 'AI 工程师 · 独立开发者',
    avatar: '🧑‍💻',
    avatarBg: '#f5f3ff',
    matchPct: 87,
    matchColor: '#7c6aff',
    matchBg: '#f5f3ff',
    borderColor: '#7c6aff',
    desc: '擅长 RAG 和知识库系统，正在做一个开源的 AI 客服框架，寻找商业化合伙人',
    contact: '微信：wangfei_ai',
  },
]

export default function AttendeeShowcase() {
  return (
    <section className="section">
      <h2 className="section-title">活动参与者获得什么</h2>
      <p className="section-subtitle">告诉 AI 你的需求，精准匹配现场最相关的人</p>

      <div className="match-container">
        {/* 用户请求 */}
        <div className="match-request">
          <div className="match-avatar match-avatar--user">你</div>
          <div className="match-bubble match-bubble--user">
            帮我找到现场潜在的技术合伙人
          </div>
        </div>

        {/* AI 回复 */}
        <div className="match-response">
          <div className="match-avatar match-avatar--ai">AI</div>
          <div className="match-response-content">
            <div className="match-bubble match-bubble--ai">
              为你从 47 位参与者中筛选出 3 位最匹配的技术合伙人：
            </div>

            {/* 推荐卡片 */}
            <div className="match-cards">
              {matches.map((m) => (
                <div
                  className="match-card"
                  key={m.name}
                  style={{ borderLeftColor: m.borderColor }}
                >
                  <div className="match-card-header">
                    <div className="match-card-info">
                      <div
                        className="match-card-avatar"
                        style={{ background: m.avatarBg }}
                      >
                        {m.avatar}
                      </div>
                      <div>
                        <div className="match-card-name">{m.name}</div>
                        <div className="match-card-title">{m.title}</div>
                      </div>
                    </div>
                    <div
                      className="match-badge"
                      style={{ background: m.matchBg, color: m.matchColor }}
                    >
                      匹配 {m.matchPct}%
                    </div>
                  </div>
                  <div className="match-card-desc">{m.desc}</div>
                  <div className="match-card-contact">{m.contact}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
