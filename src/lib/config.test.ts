import { describe, expect, it } from 'vitest'
import { parseLinksConfig } from './config'

const valid = {
  title: '测试',
  categories: [{ id: 'one', name: '一', links: [{ id: 'two', name: '二', url: 'https://example.com' }] }],
}

describe('parseLinksConfig', () => {
  it('接受有效 HTTPS 配置', () => expect(parseLinksConfig(valid)).toEqual(valid))
  it('接受多行 snippet', () => {
    const withSnippet = {
      ...valid,
      categories: [{ ...valid.categories[0], links: [{ ...valid.categories[0].links[0], snippet: 'SELECT *\nFROM logs' }] }],
    }
    expect(parseLinksConfig(withSnippet)).toEqual(withSnippet)
  })
  it('拒绝空 snippet', () => {
    const withSnippet = {
      ...valid,
      categories: [{ ...valid.categories[0], links: [{ ...valid.categories[0].links[0], snippet: '  ' }] }],
    }
    expect(() => parseLinksConfig(withSnippet)).toThrow()
  })
  it('拒绝 HTTP URL', () => expect(() => parseLinksConfig({ ...valid, categories: [{ ...valid.categories[0], links: [{ ...valid.categories[0].links[0], url: 'http://example.com' }] }] })).toThrow('绝对 HTTPS'))
  it('拒绝重复 ID', () => expect(() => parseLinksConfig({ ...valid, categories: [{ ...valid.categories[0], links: [{ ...valid.categories[0].links[0], id: 'one' }] }] })).toThrow('全局唯一'))
  it('拒绝缺失必填字段', () => expect(() => parseLinksConfig({ categories: [] })).toThrow())
  it('接受业务域名配置', () => {
    const withServices = {
      ...valid,
      services: [
        { id: 'order', name: '订单系统', url: 'https://order.example.com', frontend: '10.0.0.11:8080', backend: '10.0.0.12:9090', description: '订单创建' },
      ],
    }
    expect(parseLinksConfig(withServices)).toEqual(withServices)
  })
  it('业务域名允许 HTTP（测试环境）', () => {
    const withServices = {
      ...valid,
      services: [{ id: 'order-test', name: '订单测试环境', url: 'http://order.test.example.com', frontend: '10.0.0.11:8080' }],
    }
    expect(parseLinksConfig(withServices)).toEqual(withServices)
  })
  it('拒绝非 HTTP(S) 业务地址', () => {
    const withServices = {
      ...valid,
      services: [{ id: 'order', name: '订单系统', url: 'ftp://order.example.com' }],
    }
    expect(() => parseLinksConfig(withServices)).toThrow('HTTP(S)')
  })
  it('拒绝与链接重复的业务 ID', () => {
    const withServices = {
      ...valid,
      services: [{ id: 'two', name: '重复', url: 'https://dup.example.com' }],
    }
    expect(() => parseLinksConfig(withServices)).toThrow('全局唯一')
  })
  it('拒绝空的前端地址', () => {
    const withServices = {
      ...valid,
      services: [{ id: 'order', name: '订单系统', url: 'https://order.example.com', frontend: '  ' }],
    }
    expect(() => parseLinksConfig(withServices)).toThrow()
  })
})
