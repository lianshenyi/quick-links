import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import type { LinksConfig } from './lib/config'

const config: LinksConfig = {
  title: '测试页面',
  categories: [
    {
      id: 'docs',
      name: '文档',
      links: [
        { id: 'example-site', name: '示例站点', url: 'https://example.com', description: '带描述的链接' },
        { id: 'example-docs', name: '示例文档', url: 'https://example.org' },
      ],
    },
  ],
}

describe('App', () => {
  it('按配置渲染分类、链接、域名和描述', () => {
    render(<App config={config} />)
    expect(screen.getByRole('heading', { name: '文档' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /示例站点/ })).toHaveAttribute('href', 'https://example.com')
    expect(screen.getByRole('link', { name: /示例站点/ })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: /示例站点/ })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('example.com')).toBeInTheDocument()
    expect(screen.getByText('带描述的链接')).toBeInTheDocument()
  })

  it('忽略空分类，并在没有链接时显示空状态', () => {
    render(<App config={{ title: '空页面', categories: [{ id: 'empty', name: '空', links: [] }] }} />)
    expect(screen.queryByRole('heading', { name: '空' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '还没有可用链接' })).toBeInTheDocument()
  })
})
