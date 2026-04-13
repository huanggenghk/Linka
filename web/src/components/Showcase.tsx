import OrganizerPanel from './OrganizerPanel'
import AttendeePanel from './AttendeePanel'

export default function Showcase() {
  return (
    <section className="showcase-section" id="showcase">
      <div className="showcase-module">
        <div className="showcase-info">
          <p className="showcase-role">ATTENDEE</p>
          <h2 className="showcase-title">寻找潜在人脉，建立精准链接</h2>
          <p className="showcase-desc">告诉 AI 你的需求，精准匹配现场最相关的人，高效建立有价值的连接</p>
        </div>
        <div className="showcase-demo">
          <AttendeePanel />
        </div>
      </div>
      <div className="showcase-module showcase-module--reverse">
        <div className="showcase-demo">
          <OrganizerPanel />
        </div>
        <div className="showcase-info">
          <p className="showcase-role">ORGANIZER</p>
          <h2 className="showcase-title">构建精准画像，洞察社群需求</h2>
          <p className="showcase-desc">每场活动结束后，自动生成参与者画像分析报告，帮助组织者了解社群构成和关注方向</p>
        </div>
      </div>
    </section>
  )
}
