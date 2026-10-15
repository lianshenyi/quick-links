import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { parseLinksConfig, type LinksConfig } from '../src/lib/config.ts'

export const CONFIG_PATH = 'config/links.yaml'

// config/links.yaml 是使用者的私有内容，不进版本控制；缺失时回退到模板，
// 保证刚克隆下来的仓库不用改任何东西就能 validate/build。
const FALLBACK_PATH = 'config/links.example.yaml'

export async function loadLinksConfig(path = CONFIG_PATH): Promise<LinksConfig> {
  let target = path
  if (!existsSync(target)) {
    console.warn(`未找到 ${path}，回退到 ${FALLBACK_PATH}（示例内容）。`)
    target = FALLBACK_PATH
  }
  const source = await readFile(target, 'utf8')
  return parseLinksConfig(parse(source))
}
