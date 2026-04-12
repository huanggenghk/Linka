export default function OrganizerPanel() {
  return (
    <div className="report-card">
      <div className="report-header">活动报告 — AI Builder Meetup · 2026.04.10</div>

      <div className="report-insight">
        <div className="report-insight-label">Core Insight</div>
        <div className="report-insight-text">
          参与者最关注「智能客服」和「知识库搭建」，建议下一场围绕这两个方向策划专场
        </div>
      </div>

      <div className="report-stats">
        {[
          { value: '47', label: '参与人数', amber: true },
          { value: '126', label: '促成连接' },
          { value: '89%', label: '匹配满意度' },
          { value: '12', label: '回头参与者' },
        ].map((stat) => (
          <div className="report-stat" key={stat.label}>
            <div className={`report-stat-value${stat.amber ? ' report-stat-value--amber' : ''}`}>
              {stat.value}
            </div>
            <div className="report-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="report-charts">
        <div className="report-chart-card">
          <div className="report-chart-title">职业分布</div>
          <div className="bar-chart">
            {[
              { label: '工程师', pct: 38 },
              { label: '产品经理', pct: 23 },
              { label: '创始人/CEO', pct: 19 },
              { label: '投资人', pct: 11 },
              { label: '其他', pct: 9 },
            ].map((bar) => (
              <div className="bar-row" key={bar.label}>
                <div className="bar-label">
                  <span>{bar.label}</span>
                  <span>{bar.pct}%</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${bar.pct}%`, opacity: bar.pct > 20 ? 1 : 0.5 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="report-chart-card">
          <div className="report-chart-title">关注的落地场景</div>
          <div className="donut-chart-wrapper">
            <div className="donut-chart">
              <svg viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#C28B3E" strokeWidth="4" strokeDasharray="32 68" strokeDashoffset="0" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#A87832" strokeWidth="4" strokeDasharray="26 74" strokeDashoffset="-32" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#D4A04A" strokeWidth="4" strokeDasharray="22 78" strokeDashoffset="-58" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#E8E8E5" strokeWidth="4" strokeDasharray="20 80" strokeDashoffset="-80" />
              </svg>
            </div>
            <div className="donut-legend">
              {[
                { label: '智能客服', pct: '32%', color: '#C28B3E' },
                { label: '知识库搭建', pct: '26%', color: '#A87832' },
                { label: 'Agent 工作流', pct: '22%', color: '#D4A04A' },
                { label: 'AI 内容生成', pct: '20%', color: '#D0D0CC' },
              ].map((item) => (
                <div className="donut-legend-item" key={item.label}>
                  <span className="donut-dot" style={{ background: item.color }} />
                  {item.label} {item.pct}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
