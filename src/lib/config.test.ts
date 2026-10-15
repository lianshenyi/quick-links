import { describe, expect, it } from 'vitest'
import { parseLinksConfig } from './config'

const valid = {
  title: '测试',
  categories: [{ id: 'one', name: '一', links: [{ id: 'two', name: '二', url: 'https://example.com' }] }],
}

describe('parseLinksConfig', () => {
  it('接受有效 HTTPS 配置', () => expect(parseLinksConfig(valid)).toEqual(valid))
  it('拒绝 HTTP URL', () => expect(() => parseLinksConfig({ ...valid, categories: [{ ...valid.categories[0], links: [{ ...valid.categories[0].links[0], url: 'http://example.com' }] }] })).toThrow('绝对 HTTPS'))
  it('拒绝重复 ID', () => expect(() => parseLinksConfig({ ...valid, categories: [{ ...valid.categories[0], links: [{ ...valid.categories[0].links[0], id: 'one' }] }] })).toThrow('全局唯一'))
  it('拒绝缺失必填字段', () => expect(() => parseLinksConfig({ categories: [] })).toThrow())
})
