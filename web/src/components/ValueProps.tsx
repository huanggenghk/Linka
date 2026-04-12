const values = [
  {
    icon: '🎯',
    title: '精准发现',
    desc: 'AI 根据你的需求，找到最值得认识的人',
  },
  {
    icon: '💎',
    title: '自动沉淀',
    desc: '人脉自动归档，需要时精准激活',
  },
  {
    icon: '🔄',
    title: '实时画像',
    desc: '画像随对话更新，始终匹配最新的你',
  },
]

export default function ValueProps() {
  return (
    <section className="section">
      <h2 className="section-title">为什么选择 Linka</h2>
      <div className="value-cards">
        {values.map((v) => (
          <div className="value-card" key={v.title}>
            <div className="value-card-icon">{v.icon}</div>
            <div className="value-card-title">{v.title}</div>
            <div className="value-card-desc">{v.desc}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
