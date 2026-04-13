export default function StoryScene1() {
  const dots = [
    'dim', 'dim', 'match', 'dim', 'dim', 'dim', 'dim',
    'dim', 'dim', 'dim', 'dim', 'match', 'dim', 'dim',
    'dim', 'dim', 'dim', 'you', 'dim', 'dim', 'dim',
    'dim', 'match', 'dim', 'dim', 'dim', 'dim', 'match',
  ]

  return (
    <div className="story">
      <div className="story-visual">
        <div className="visual-crowd">
          <div className="crowd-grid">
            {dots.map((type, i) => (
              <div
                key={i}
                className={`crowd-dot ${
                  type === 'you' ? 'crowd-dot--you' :
                  type === 'match' ? 'crowd-dot--match' :
                  'crowd-dot--dim'
                }`}
              />
            ))}
          </div>
          <div className="crowd-label">200 人会场 · 4 位匹配</div>
        </div>
      </div>
      <div className="story-content">
        <div className="story-label">SCENE 01</div>
        <h2 className="story-pain">200 人的活动，你只能聊 10 个</h2>
        <p className="story-solution">
          参加了活动，却错过了最值得结交的人。
          <br /><br />
          <strong>加入 Linka</strong>，你的 Agent 自动扫描全场参与者画像，把最匹配的人推送给你——不用挨个交流，也不会错过关键人脉。
        </p>
      </div>
    </div>
  )
}
