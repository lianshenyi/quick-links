# Quick Links

一个由 Git 管理的静态快捷链接页。内容唯一来源是 `config/links.yaml`；构建时会校验并生成供 React 使用的静态配置。

技术栈：React + Vite + TypeScript，产物由 Nginx 提供静态服务，可部署到任意 Kubernetes 集群。

## 本地开发

```bash
npm install
cp config/links.example.yaml config/links.yaml   # 改成自己的链接
npm run dev
```

`config/links.yaml` 是使用者的私有内容，默认不纳入版本控制；仓库只提交模板 `config/links.example.yaml`。该文件缺失时构建会自动回退到模板并打印警告，所以新克隆不做任何修改也能跑通。

提交前运行：

```bash
npm test
npm run build
```

`npm run build` 会先执行 YAML 校验。校验要求 `title`、分类和链接的 `id/name`、链接 `url` 均存在；所有分类、链接、业务 ID 全局唯一；链接 `url` 必须是绝对 `https://` 地址，业务域名 `url` 允许 `http://`（测试环境）或 `https://`；可选字段 `description`、`snippet`、`frontend`、`backend` 若提供则不能为空。空分类会被页面隐藏；没有可显示链接时展示空状态。

## 配置格式

分类及其链接按 YAML 中的声明顺序渲染：

```yaml
title: 常用链接
categories:
  - id: llm-api
    name: LLM API
    links:
      - id: deepseek-top-up
        name: DeepSeek 充值
        url: https://platform.deepseek.com/top_up
        description: 可选说明
```

`description` 只适合一句话摘要。需要展示多行查询语法或命令时用可选的 `snippet`（YAML 字面块 `|`），默认折叠在卡片底部，点开后显示等宽代码块并带复制按钮：

```yaml
      - id: openobserve
        name: OpenObserve
        url: https://observe.example.com
        description: 日志查询
        snippet: |
          SELECT *
          FROM logs
          LIMIT 100
```

需要给开发同学展示 nginx 业务域名与前后端映射时，用可选的顶层 `services`；页面会在分类下方渲染轻量表格（域名可点击，`ip:端口` 等宽显示），移动端自动堆叠为卡片：

```yaml
services:
  - id: order
    name: 订单系统
    url: http://order.example.com
    frontend: 10.0.0.11:8080
    backend: 10.0.0.12:9090
    description: 订单创建、支付回调
```

`name`、`url` 必填（`url` 支持 HTTP/HTTPS，测试环境可直接写 `http://`）；`frontend`、`backend`、`description` 可选，缺失时显示 `—`。

## 发布

部署清单位于 `deploy/` 和 `apisix/`。其中的域名、镜像仓库地址、ServiceAccount 都是占位值，需要替换成自己环境的实际值：

| 位置 | 需要替换 |
|---|---|
| `deploy/deployment.yaml` | `image` 的仓库地址、`imagePullSecrets` 名称 |
| `apisix/apisix-route.yaml` | `hosts` 域名 |
| `deploy/rbac.yaml` | ClusterRoleBinding 的 subject（构建 Agent 的 ServiceAccount） |
| `build/Jenkinsfile` | 共享库名、`credentialsId`、validate 镜像 |

先创建镜像仓库项目和拉取 Secret，再应用以下无密钥清单：

```bash
kubectl apply -f deploy/namespace.yaml
kubectl apply -f deploy/rbac.yaml
kubectl apply -f deploy/deployment.yaml -f deploy/service.yaml
kubectl apply -f apisix/apisix-route.yaml
```

### CI

`build/Jenkinsfile` 只声明应用参数，构建/推送/rollout 的逻辑在 Jenkins 全局共享库的 `webAppPipeline` 里。没有对应共享库时，把该文件换成自己的流水线即可，等价流程是：

1. `npm ci && npm run validate-config && npm test`——校验和测试失败即中止。
2. `docker build` 并推送到镜像仓库，tag 用 Git 短 SHA（不要用 `latest`）。
3. `kubectl -n <namespace> set image` + `kubectl rollout status --timeout=180s`，失败即 Job 失败。

凭据只保存在 CI / 镜像仓库 / Kubernetes 的凭据系统里，绝不提交进本仓库。

### 权限

部署路径上的身份被刻意收窄，见 `deploy/rbac.yaml`：

- `quick-links-deployer`：只允许读取 Deployment/ReplicaSet/Pod 状态，以及 patch `quick-links-web` 这一个 Deployment，不能读 Secret。
- `quick-links-route-reader`：ClusterRole，只给 `ApisixRoute` 与 `Ingress` 的 `get/list`，供构建期采集集群路由使用（见下一节）。因为跨 namespace 读取，绑定的是构建 Agent Pod 实际运行的那个 ServiceAccount。

Nginx 同时提供轻量 `GET /healthz`，而 Kubernetes 探针按约定检查首页 `GET /`。

## k8s 集群链接自动生成

「k8s集群」分类不进 Git，由 CI 构建时自动生成：Jenkins validate 阶段（集群 Agent Pod 内）运行 `npm run sync-cluster-links`，经 ServiceAccount 直连 K8s API 采集对外 host（需 `deploy/rbac.yaml` 中的 `quick-links-route-reader` 只读权限），写入 `src/generated/cluster-links.json`（gitignore）；随后的 docker build 内 `generate-config` 将其与手工配置合并并整体校验，打进镜像。

采集来源：`ApisixRoute`（apisix.apache.org/v2）和 `Ingress`（仅 `ingressClassName=apisix`，避免混入其他网关域名）。规则：每个 host 一条链接（去重）；链接名取子域名，子域名重复时用完整 host（点换连字符）作 ID；description 为 `namespace/路由名`；无 host 的路由跳过。

本地开发时脚本自动回退到 `kubectl` 当前 context；无法访问集群时降级为空分类并警告。`SKIP_CLUSTER_SYNC=1` 则完全不访问集群（不探测集群内环境、也不回退 kubectl），直接生成空分类，供无集群权限时显式跳过。集群内采集失败则构建失败，阻断发布。

## 验证、故障与回滚

确认 DNS 与 TLS 已将该域名指向 APISIX 后：

```bash
kubectl -n quick-links get deploy,pods,svc,apisixroute
kubectl -n quick-links rollout status deployment/quick-links-web --timeout=180s
curl -fsSI https://links.example.com/
```

无效配置会在 CI 的测试阶段失败，镜像不会 push、Deployment 不会变更。若发布后的版本需回退：

```bash
kubectl -n quick-links rollout undo deployment/quick-links-web
```

凭据轮换由镜像仓库管理员轮换拉取凭据、由 CI 管理员轮换推送凭据；应用仓库不保存任意凭据。

## 结构

```
apisix/           APISIX 路由（对外入口）
build/            Jenkinsfile
config/           links.yaml（私有）/ links.example.yaml（模板）
deploy/           Namespace / Deployment / Service / RBAC
scripts/          YAML 校验、配置生成、集群路由采集
src/              React 前端
```

## License

[Apache-2.0](LICENSE)
