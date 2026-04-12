const organizerPoints = [
  '每场活动自动沉淀参与者画像，越办越了解你的社群',
  '基于真实画像数据，策划更有针对性的活动主题',
  '精准邀约对的人参加对的活动，提升每场活动质量',
  '数据驱动社群运营，让活动的长期价值持续增长',
]

const attendeePoints = [
  '告诉 AI 你的需求，精准匹配现场最相关的人',
  '画像随对话实时更新，推荐始终基于最新的你',
  '跨活动人脉自动积累，随时激活历史连接',
  '无需下载 App，和你的 AI 助手说一句话就能加入',
]

export default function Perspectives() {
  return (
    <section className="section">
      <h2 className="section-title">两种角色，同一个平台</h2>
      <div className="perspectives-grid">
        <div className="perspective-card perspective-card--organizer">
          <div className="perspective-icon">🏢</div>
          <div className="perspective-title">活动组织者</div>
          <ul className="perspective-items">
            {organizerPoints.map((point) => (
              <li className="perspective-item" key={point}>
                <span className="perspective-bullet--orange">✦</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="perspective-card perspective-card--attendee">
          <div className="perspective-icon">👤</div>
          <div className="perspective-title">活动参与者</div>
          <ul className="perspective-items">
            {attendeePoints.map((point) => (
              <li className="perspective-item" key={point}>
                <span className="perspective-bullet--purple">✦</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
