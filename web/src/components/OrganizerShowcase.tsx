export default function OrganizerShowcase() {
  return (
    <section className="section">
      <h2 className="section-title">活动组织者获得什么</h2>
      <p className="section-subtitle">每场活动结束后，自动生成参与者画像分析报告</p>

      <div className="report-card">
        <div className="report-header">活动报告 — AI Builder Meetup · 2026.04.10</div>

        {/* 核心发现 */}
        <div className="report-insight">
          <div className="report-insight-label">💡 核心发现</div>
          <div className="report-insight-text">
            参与者最关注「智能客服」和「知识库搭建」，建议下一场围绕这两个方向策划专场
          </div>
        </div>

        {/* 数据概览 */}
        <div className="report-stats">
          {[
            { value: '47', label: '参与人数', color: '#e67e22' },
            { value: '126', label: '促成连接', color: '#7c6aff' },
            { value: '89%', label: '匹配满意度', color: '#27ae60' },
            { value: '12', label: '回头参与者', color: '#2c3e50' },
          ].map((stat) => (
            <div className="report-stat" key={stat.label}>
              <div className="report-stat-value" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="report-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 图表区域 */}
        <div className="report-charts">
          {/* 职业分布 */}
          <div className="report-chart-card">
            <div className="report-chart-title">职业分布</div>
            <div className="bar-chart">
              {[
                { label: '工程师', pct: 38, color: '#e67e22' },
                { label: '产品经理', pct: 23, color: '#7c6aff' },
                { label: '创始人/CEO', pct: 19, color: '#27ae60' },
                { label: '投资人', pct: 11, color: '#f39c12' },
                { label: '其他', pct: 9, color: '#95a5a6' },
              ].map((bar) => (
                <div className="bar-row" key={bar.label}>
                  <div className="bar-label">
                    <span>{bar.label}</span>
                    <span>{bar.pct}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${bar.pct}%`, background: bar.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 关注场景 */}
          <div className="report-chart-card">
            <div className="report-chart-title">关注的落地场景</div>
            <div className="donut-chart-wrapper">
              <div className="donut-chart">
                <svg viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#e67e22" strokeWidth="4" strokeDasharray="32 68" strokeDashoffset="0" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#7c6aff" strokeWidth="4" strokeDasharray="26 74" strokeDashoffset="-32" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#27ae60" strokeWidth="4" strokeDasharray="22 78" strokeDashoffset="-58" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f39c12" strokeWidth="4" strokeDasharray="20 80" strokeDashoffset="-80" />
                </svg>
              </div>
              <div className="donut-legend">
                {[
                  { label: '智能客服', pct: '32%', color: '#e67e22' },
                  { label: '知识库搭建', pct: '26%', color: '#7c6aff' },
                  { label: 'Agent 工作流', pct: '22%', color: '#27ae60' },
                  { label: 'AI 内容生成', pct: '20%', color: '#f39c12' },
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
    </section>
  )
}
