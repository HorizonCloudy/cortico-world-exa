# cortico-world-exa

Cortico 的 Exa 网络搜索 World 插件。世界 id 是 `exa`，暴露一个搜索工具 `exa_search`，让 bot 替用户搜索网页，并把结果（标题、网址、摘要）交给 bot 引用。

## 工具

| 工具 | 作用 |
| --- | --- |
| `exa_search(query, max_results?)` | 用 Exa 搜索网页，返回每条结果的标题、网址和摘要。`max_results` 取 1–10，默认 5。 |

## 事件

| 事件 | 含义 |
| --- | --- |
| `exa.started` | 世界已挂载，`exa` 已就绪。 |

## API key 怎么配置

Exa 密钥名是 `EXA_API_KEY`。密钥由宿主通过 secret 注入到世界，世界本身**不存密钥**，也**不把密钥写进配置文件明文**。

配置步骤（参考 `npx skills use "https://github.com/exa-labs/agent-skills" --skill "build-with-exa"`）：

1. 在 Exa 控制台获取 `EXA_API_KEY`。
2. 由宿主把密钥注入为 secret `EXA_API_KEY`（不同宿主的操作见宿主文档，不要直接填进 `worlds.exa` 配置）。
3. 世界在每次搜索时读取 secret，通过请求头 `x-api-key` 发给 `https://api.exa.ai/search`。

密钥缺失时，`exa_search` handler 抛出错误并提示配置密钥。

## 如何安装 cortico SDK

本插件按模板规范编写，`cortico/*` 在 tsconfig 里映射到 `../../vendor/cortico/src`。vendor/cortico 是空 submodule，待宿主或 submodule 提供 SDK 后才能编译运行。

- 初始化 submodule：`git submodule update --init vendor/cortico`
- 或按宿主（Coopanion / Cortico）提供的 SDK 安装指南操作。

## 如何运行

在 `packages/cortico-world-exa/` 目录下：

- `pnpm test`：跑 vitest 测试。
- `pnpm typecheck`：`tsc --noEmit` 做类型检查（需要 cortico SDK 到位后才能通过）。

## Known limitation

Exa 的 REST 端点按文档推断是 `https://api.exa.ai/search`，请求体 `{ query, num_results: max_results }`，请求头 `x-api-key`。若 anysearch / tavily / Exa 官方 REST 规范有变更，以官方为准。
