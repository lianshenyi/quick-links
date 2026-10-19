import { z } from 'zod'

const nonEmptyText = z.string().trim().min(1, '不能为空')
const httpsUrl = z.string().url('必须是有效 URL').refine(
  (value) => new URL(value).protocol === 'https:',
  '必须是绝对 HTTPS URL',
)

// 业务域名允许测试环境的 HTTP 地址
const httpUrl = z.string().url('必须是有效 URL').refine(
  (value) => ['http:', 'https:'].includes(new URL(value).protocol),
  '必须是绝对 HTTP(S) URL',
)

const linkSchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText,
  url: httpsUrl,
  description: nonEmptyText.optional(),
  snippet: nonEmptyText.optional(),
})

const categorySchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText,
  links: z.array(linkSchema),
})

const serviceSchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText,
  url: httpUrl,
  frontend: nonEmptyText.optional(),
  backend: nonEmptyText.optional(),
  description: nonEmptyText.optional(),
})

const rawConfigSchema = z.object({
  title: nonEmptyText,
  categories: z.array(categorySchema),
  services: z.array(serviceSchema).optional(),
})

export type Link = z.infer<typeof linkSchema>
export type Category = z.infer<typeof categorySchema>
export type Service = z.infer<typeof serviceSchema>
export type LinksConfig = z.infer<typeof rawConfigSchema>

export function parseLinksConfig(input: unknown): LinksConfig {
  const config = rawConfigSchema.parse(input)
  const ids = new Set<string>()

  const items = [
    ...config.categories.flatMap((category) => [category, ...category.links]),
    ...(config.services ?? []),
  ]

  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`ID 必须全局唯一：${item.id}`)
    }
    ids.add(item.id)
  }

  return config
}
