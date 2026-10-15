import { linksConfig } from './generated/links'
import type { LinksConfig } from './lib/config'
import './App.css'

function hostname(url: string): string {
  return new URL(url).hostname
}

export function App({ config = linksConfig }: { config?: LinksConfig }) {
  const categories = config.categories.filter((category) => category.links.length > 0)

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
                  <a
                    className="link-card"
                    href={link.url}
                    key={link.id}
                    rel="noopener noreferrer"
                    target="_blank"
                    aria-label={`${link.name}（在新标签页打开）`}
                  >
                    <span className="link-name">{link.name}</span>
                    {link.description && <span className="link-description">{link.description}</span>}
                    <span className="link-host">{hostname(link.url)}</span>
                    <span className="open-mark" aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
