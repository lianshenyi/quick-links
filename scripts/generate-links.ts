import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseLinksConfig, type LinksConfig } from '../src/lib/config.ts'
import { loadLinksConfig } from './config-file.ts'

// 合并手工配置（config/links.yaml，缺失时回退到 config/links.example.yaml）
// 与集群采集结果（src/generated/cluster-links.json，由 sync-cluster-links.ts 生成），
// 整体校验后生成前端消费的 links.ts。
// cluster-links.json 不存在时（首次开发）仅使用手工配置。

const manual = await loadLinksConfig()

let config: LinksConfig = manual
if (existsSync('src/generated/cluster-links.json')) {
  const clusterLinks = JSON.parse(await readFile('src/generated/cluster-links.json', 'utf8')) as LinksConfig['categories'][number]['links']
  config = parseLinksConfig({
    ...manual,
    categories: [
      ...manual.categories,
      { id: 'k8s-cluster', name: 'k8s集群', links: clusterLinks },
    ],
  })
}

const output = 'src/generated/links.ts'
await mkdir('src/generated', { recursive: true })
await writeFile(
  output,
  `// 此文件由 scripts/generate-links.ts 生成，请勿手动编辑。\n` +
    `import type { LinksConfig } from '../lib/config'\n\n` +
    `export const linksConfig: LinksConfig = ${JSON.stringify(config, null, 2)}\n`,
)
console.log(`已生成 ${output}：${config.categories.length} 个分类`)
