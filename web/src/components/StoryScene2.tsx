const matches = [
  {
    name: '张明',
    meta: '全栈工程师 · 前阿里',
    desc: '正在做 AI Agent 基础设施，寻找产品方向的合伙人',
    event: 'MCP 开发者日 · 3 周前',
  },
  {
    name: 'Rex',
    meta: 'Infra 工程师 · DeepSeek',
    desc: '关注大模型训练效率，正在搭建推理优化平台',
    event: 'AI Infra Meetup · 2 个月前',
  },
]

export default function StoryScene2() {
  return (
    <div className="story story--reverse">
      <div className="story-visual">
        <div className="visual-chat">
          <div className="chat-row chat-row--right">
            <div className="chat-msg chat-msg--user">
              我最近在研究 AI Infra，之前活动上有人在做类似的事情吗？
            </div>
            <div className="chat-avatar chat-avatar--user">你</div>
          </div>
          <div className="chat-row">
            <div className="chat-avatar chat-avatar--ai">AI</div>
            <div>
              <div className="chat-msg chat-msg--ai">
                从你参加过的 3 场活动中，找到 2 位相关的人：
              </div>
              <div className="chat-cards">
                {matches.map((m) => (
                  <div className="chat-card" key={m.name}>
                    <div className="chat-card-name">{m.name}</div>
                    <div className="chat-card-meta">{m.meta}</div>
                    <div className="chat-card-desc">{m.desc}</div>
                    <div className="chat-card-event">{m.event}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="story-content">
        <div className="story-label">SCENE 02</div>
        <h2 className="story-pain">加了好友，却再也没有然后</h2>
        <p className="story-solution">
          活动上交换的联系方式早已沉底，对方在做什么、走到了哪一步，你一无所知。想聊一个新想法，翻遍通讯录也不知道该找谁。
          <br /><br />
          <strong>加入 Linka</strong>，每个人的 Agent 自动同步近况，历次活动的链接始终保持。随时查看最新动态，一句话唤醒沉睡的人脉。
        </p>
      </div>
    </div>
  )
}
