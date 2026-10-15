import { execSync } from 'node:child_process'
import https from 'node:https'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

// 采集集群内两类路由资源的对外 host，生成 src/generated/cluster-links.json
// 供 scripts/generate-links.ts 合并进最终配置：
//   - ApisixRoute（apisix.apache.org/v2）
//   - Ingress（仅 ingressClassName=apisix）
// 运行环境二选一，自动探测：
//   - 集群内（Jenkins Agent Pod）：读 ServiceAccount token 直接调 K8s API
//   - 本地：回退到 kubectl（取当前 context）
// 环境变量 SKIP_CLUSTER_SYNC=1 时完全不访问集群：不探测集群内环境，也不回退到 kubectl，直接生成空集。

const OUTPUT = 'src/generated/cluster-links.json'
const SA_DIR = '/var/run/secrets/kubernetes.io/serviceaccount'

type RouteSource = { ns: string, name: string, hosts: string[] }

// ---------- 采集 ----------

function inClusterAvailable(): boolean {
  return !!process.env.KUBERNETES_SERVICE_HOST
}

function inClusterGet(path: string): Promise<unknown> {
  return Promise.all([
    readFile(`${SA_DIR}/token`, 'utf8'),
    readFile(`${SA_DIR}/ca.crt`, 'utf8'),
  ]).then(([token, ca]) => new Promise((resolve, reject) => {
    const req = https.get({
      host: process.env.KUBERNETES_SERVICE_HOST,
      port: process.env.KUBERNETES_SERVICE_PORT_HTTPS ?? '443',
      path,
      ca,
      headers: { Authorization: `Bearer ${token.trim()}` },
      timeout: 10_000,
    }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`K8s API ${path} 返回 ${res.statusCode}：${body.slice(0, 200)}`))
          return
        }
        resolve(JSON.parse(body))
      })
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('K8s API 请求超时')))
  }))
}

function kubectlJson(args: string): unknown {
  const raw = execSync(`kubectl ${args}`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return JSON.parse(raw)
}

// 两种资源统一成 { ns, name, hosts }。
function extractSources(apisixJson: unknown, ingressJson: unknown): RouteSource[] {
  const sources: RouteSource[] = []

  const apisix = apisixJson as {
    items: Array<{
      metadata: { namespace: string, name: string }
      spec?: { http?: Array<{ match?: { hosts?: string[] } }> }
    }>
  }
  for (const item of apisix.items) {
    const hosts = (item.spec?.http ?? []).flatMap((h) => h.match?.hosts ?? [])
    sources.push({ ns: item.metadata.namespace, name: item.metadata.name, hosts })
  }

  const ingresses = ingressJson as {
    items: Array<{
      metadata: { namespace: string, name: string }
      spec?: {
        ingressClassName?: string
        rules?: Array<{ host?: string }>
        tls?: Array<{ hosts?: string[] }>
      }
    }>
  }
  for (const item of ingresses.items) {
    if (item.spec?.ingressClassName !== 'apisix') continue
    const hosts = [
      ...(item.spec?.rules ?? []).map((r) => r.host).filter((h): h is string => !!h),
      ...(item.spec?.tls ?? []).flatMap((t) => t.hosts ?? []),
    ]
    sources.push({ ns: item.metadata.namespace, name: item.metadata.name, hosts })
  }

  return sources
}

// ---------- 生成链接 ----------

// 每个 host 一条链接；无 host 的路由跳过。
function routesToLinks(sources: RouteSource[]): Array<{
  id: string, name: string, url: string, description: string,
}> {
  const byHost = new Map<string, { ns: string, route: string }>()
  for (const src of sources) {
    for (const host of src.hosts) {
      if (!byHost.has(host)) {
        byHost.set(host, { ns: src.ns, route: src.name })
      }
    }
  }

  const subdomainCounts = new Map<string, number>()
  for (const host of byHost.keys()) {
    const sub = host.split('.')[0]
    subdomainCounts.set(sub, (subdomainCounts.get(sub) ?? 0) + 1)
  }

  return [...byHost.entries()].map(([host, meta]) => {
    const sub = host.split('.')[0]
    const subDuplicated = (subdomainCounts.get(sub) ?? 0) > 1
    const slug = subDuplicated ? host.replaceAll('.', '-') : sub
    return {
      id: slug,
      name: sub,
      url: `https://${host}`,
      description: `${meta.ns}/${meta.route}`,
    }
  }).sort((a, b) => a.id.localeCompare(b.id))
}

// ---------- 主流程 ----------

const EMPTY = '[]'

async function collect(): Promise<RouteSource[]> {
  if (process.env.SKIP_CLUSTER_SYNC === '1') {
    console.log('SKIP_CLUSTER_SYNC=1：跳过集群路由采集，k8s集群 分类将为空。')
    return []
  }

  if (inClusterAvailable()) {
    const [apisix, ingress] = await Promise.all([
      inClusterGet('/apis/apisix.apache.org/v2/apisixroutes'),
      inClusterGet('/apis/networking.k8s.io/v1/ingresses'),
    ])
    return extractSources(apisix, ingress)
  }

  // 本地回退：kubectl 当前 context
  const apisix = kubectlJson('get apisixroute -A -o json')
  const ingress = kubectlJson('get ingress -A -o json')
  return extractSources(apisix, ingress)
}

try {
  const links = routesToLinks(await collect())
  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, JSON.stringify(links, null, 2))
  console.log(`已生成 k8s集群 链接 ${links.length} 条 → ${OUTPUT}`)
} catch (error) {
  if (inClusterAvailable()) {
    // 集群内构建采集失败说明环境异常，应阻断发布。
    console.error('集群路由采集失败：', error)
    process.exit(1)
  }
  // 本地构建无集群权限时降级为空分类，不阻塞。
  console.warn('警告：集群路由采集失败（本地构建），k8s集群 分类将为空。', error)
  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, EMPTY)
}
