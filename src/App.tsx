import { useEffect, useState } from 'react'
import { linksConfig } from './generated/links'
import type { LinksConfig } from './lib/config'
import './App.css'

function hostname(url: string): string {
  return new URL(url).hostname
}

function SnippetBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // 剪贴板不可用时保持原状，仍可手动选中复制
    }
  }

  return (
    <details className="link-snippet">
      <summary>查询语法</summary>
      <div className="snippet-body">
        <button className="snippet-copy" type="button" onClick={copy}>
          {copied ? '已复制' : '复制'}
        </button>
        <pre><code>{text}</code></pre>
      </div>
    </details>
  )
}

export function App({ config = linksConfig }: { config?: LinksConfig }) {
  const categories = config.categories.filter((category) => category.links.length > 0)
  const services = config.services ?? []

  return (
    <main className="page-shell">
      <header className="site-header">
        <p className="eyebrow">QUICK LINKS</p>
        <h1>{config.title}</h1>
        <p className="intro">把常用服务放在一个清晰、可维护的入口。</p>
      </header>

      {categories.length === 0 ? (
        <section className="empty-state" aria-label="空链接列表">
          <h2>还没有可用链接</h2>
          <p>请在 <code>config/links.yaml</code> 添加分类和链接后重新发布。</p>
        </section>
      ) : (
        <div className="categories">
          {categories.map((category) => (
            <section className="category" aria-labelledby={`category-${category.id}`} key={category.id}>
              <h2 id={`category-${category.id}`}>{category.name}</h2>
              <div className="link-grid">
                {category.links.map((link) => (
                  <article className="link-card" key={link.id}>
                    <a
                      className="link-card-main"
                      href={link.url}
                      rel="noopener noreferrer"
                      target="_blank"
                      aria-label={`${link.name}（在新标签页打开）`}
                    >
                      <span className="link-name">{link.name}</span>
                      {link.description && <span className="link-description">{link.description}</span>}
                      <span className="link-host">{hostname(link.url)}</span>
                      <span className="open-mark" aria-hidden="true">↗</span>
                    </a>
                    {link.snippet && <SnippetBlock text={link.snippet} />}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {services.length > 0 && (
        <section className="services" aria-labelledby="services-heading">
          <h2 id="services-heading">业务域名</h2>
          <div className="service-table-wrap">
            <table className="service-table">
              <thead>
                <tr>
                  <th scope="col">业务 / 域名</th>
                  <th scope="col">前端</th>
                  <th scope="col">后端</th>
                  <th scope="col">功能说明</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td data-label="业务">
                      <span className="service-name">{service.name}</span>
                      <a
                        className="service-url"
                        href={service.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        title={service.url}
                      >
                        {hostname(service.url)}
                      </a>
                    </td>
                    <td data-label="前端"><code>{service.frontend ?? '—'}</code></td>
                    <td data-label="后端"><code>{service.backend ?? '—'}</code></td>
                    <td className="service-description" data-label="说明">{service.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
