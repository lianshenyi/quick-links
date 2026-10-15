import { z } from 'zod'

const nonEmptyText = z.string().trim().min(1, '不能为空')
const httpsUrl = z.string().url('必须是有效 URL').refine(
  (value) => new URL(value).protocol === 'https:',
  '必须是绝对 HTTPS URL',
)

const linkSchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText,
  url: httpsUrl,
  description: nonEmptyText.optional(),
})

const categorySchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText,
  links: z.array(linkSchema),
})

const rawConfigSchema = z.object({
  title: nonEmptyText,
  categories: z.array(categorySchema),
})

export type Link = z.infer<typeof linkSchema>
export type Category = z.infer<typeof categorySchema>
export type LinksConfig = z.infer<typeof rawConfigSchema>

export function parseLinksConfig(input: unknown): LinksConfig {
  const config = rawConfigSchema.parse(input)
  const ids = new Set<string>()

  for (const category of config.categories) {
    for (const item of [category, ...category.links]) {
      if (ids.has(item.id)) {
        throw new Error(`ID 必须全局唯一：${item.id}`)
      }
      ids.add(item.id)
    }
  }

  return config
}
