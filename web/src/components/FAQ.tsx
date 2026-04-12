import { useState } from 'react'

const faqs = [
  {
    q: '什么是 MCP？',
    a: 'MCP（Model Context Protocol）是一种让 AI 助手连接外部工具的开放协议。Linka 通过 MCP 让你的 AI 助手具备社交网络能力，无需额外开发。',
  },
  {
    q: '需要下载 App 吗？',
    a: '不需要。Linka 运行在你已有的 AI 助手中（如 Claude、飞书等），只需添加一段 MCP 配置即可使用。',
  },
  {
    q: '我的数据安全吗？',
    a: '你的画像信息仅用于活动内的匹配推荐，不会被用于其他用途。你可以随时要求删除自己的数据。',
  },
  {
    q: '支持哪些 AI 助手？',
    a: '任何支持 MCP 协议的 AI 客户端都可以接入，包括 Claude Desktop、飞书 aily、QClaw 等。随着 MCP 生态的发展，支持的客户端会越来越多。',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i)
  }

  return (
    <section className="section">
      <h2 className="section-title">常见问题</h2>
      <div className="faq-list">
        {faqs.map((faq, i) => (
          <div className="faq-item" key={i}>
            <button className="faq-question" onClick={() => toggle(i)}>
              <span>{faq.q}</span>
              <span className={`faq-arrow ${openIndex === i ? 'faq-arrow--open' : ''}`}>
                ▸
              </span>
            </button>
            {openIndex === i && <div className="faq-answer">{faq.a}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
