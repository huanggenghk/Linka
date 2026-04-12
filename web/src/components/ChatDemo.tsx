const messages = [
  {
    role: 'user' as const,
    text: '帮我加入活动，邀请码是 A2B3C4D5',
  },
  {
    role: 'ai' as const,
    text: '已加入「AI Builder Meetup」✅ 当前 23 人参加。我根据你的背景分析了所有参与者，发现有 3 位和你高度匹配。',
  },
  {
    role: 'user' as const,
    text: '帮我找到现场潜在的技术合伙人',
  },
  {
    role: 'ai' as const,
    text: '根据你的方向，我推荐这 2 位：\n\n1. 张明 — 全栈工程师，专注 AI Agent 基础设施，正在寻找产品方向的合伙人。微信：zhangming_dev\n\n2. 李然 — 前字节后端架构师，对 MCP 生态感兴趣，想找技术合伙人一起创业。微信：liran_arch',
  },
]

export default function ChatDemo() {
  return (
    <section className="section">
      <h2 className="section-title">真实使用场景</h2>
      <div className="chat-container">
        {messages.map((msg, i) => (
          <div
            className={`chat-bubble-row ${msg.role === 'ai' ? 'chat-bubble-row--ai' : ''}`}
            key={i}
          >
            <div
              className={`chat-avatar ${msg.role === 'user' ? 'chat-avatar--user' : 'chat-avatar--ai'}`}
            >
              {msg.role === 'user' ? '你' : 'AI'}
            </div>
            <div
              className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--ai'}`}
              style={{ whiteSpace: 'pre-line' }}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
