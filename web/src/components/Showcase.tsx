import OrganizerPanel from './OrganizerPanel'
import AttendeePanel from './AttendeePanel'

export default function Showcase() {
  return (
    <section className="showcase-section">
      <div className="showcase-grid">
        <div className="showcase-column">
          <h2 className="showcase-title showcase-title--orange">
            构建精准画像，洞察社群需求
          </h2>
          <p className="showcase-role">活动组织者</p>
          <OrganizerPanel />
        </div>
        <div className="showcase-column">
          <h2 className="showcase-title showcase-title--purple">
            寻找潜在人脉，建立精准链接
          </h2>
          <p className="showcase-role">活动参与者</p>
          <AttendeePanel />
        </div>
      </div>
    </section>
  )
}
