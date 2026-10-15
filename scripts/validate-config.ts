import { loadLinksConfig } from './config-file.ts'

try {
  const config = await loadLinksConfig()
  const links = config.categories.reduce((total, category) => total + category.links.length, 0)
  console.log(`配置有效：${config.categories.length} 个分类，${links} 个链接`)
} catch (error) {
  console.error('配置无效：', error)
  process.exitCode = 1
}
