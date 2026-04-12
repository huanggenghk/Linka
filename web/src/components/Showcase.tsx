import OrganizerPanel from './OrganizerPanel'
import AttendeePanel from './AttendeePanel'

export default function Showcase() {
  return (
    <section className="showcase-section" id="showcase">
      <div className="showcase-module">
        <h2 className="showcase-title">构建精准画像，洞察社群需求</h2>
        <p className="showcase-role">ORGANIZER</p>
        <OrganizerPanel />
      </div>
      <div className="showcase-module">
        <h2 className="showcase-title">寻找潜在人脉，建立精准链接</h2>
        <p className="showcase-role">ATTENDEE</p>
        <AttendeePanel />
      </div>
    </section>
  )
}
