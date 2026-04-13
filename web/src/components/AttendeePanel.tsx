const matches = [
  {
    name: '张明',
    title: '全栈工程师 · 前阿里',
    avatar: '👨‍💻',
    matchPct: 96,
    desc: '专注 AI Agent 基础设施，正在寻找有产品思维的合伙人，一起做企业级 Agent 平台',
    contact: 'zhangming_dev',
  },
  {
    name: '李然',
    title: '后端架构师 · 前字节',
    avatar: '👩‍💻',
    matchPct: 91,
    desc: '对 MCP 生态深度研究，想找技术合伙人做开发者工具方向的创业',
    contact: 'liran_arch',
  },
  {
    name: '王飞',
    title: 'AI 工程师 · 独立开发者',
    avatar: '🧑‍💻',
    matchPct: 87,
    desc: '擅长 RAG 和知识库系统，正在做一个开源的 AI 客服框架，寻找商业化合伙人',
    contact: 'wangfei_ai',
  },
]

export default function AttendeePanel() {
  return (
    <div className="match-container">
      <div className="match-request">
        <div className="match-bubble match-bubble--user">
          我要找技术合伙人，可以先找谁聊聊？
        </div>
        <div className="match-avatar match-avatar--user">你</div>
      </div>

      <div className="match-response">
        <div className="match-avatar match-avatar--ai">AI</div>
        <div className="match-response-content">
          <div className="match-bubble match-bubble--ai">
            为你从 47 位参与者中筛选出 3 位最匹配的技术合伙人：
          </div>

          <div className="match-cards">
            {matches.map((m) => (
              <div className="match-card" key={m.name}>
                <div className="match-card-header">
                  <div className="match-card-info">
                    <div className="match-card-avatar">{m.avatar}</div>
                    <div>
                      <div className="match-card-name">{m.name}</div>
                      <div className="match-card-title">{m.title}</div>
                    </div>
                  </div>
                  <div className="match-badge">匹配 {m.matchPct}%</div>
                </div>
                <div className="match-card-desc">{m.desc}</div>
                <div className="match-card-contact">联系方式：{m.contact}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
