# Changelog

## 0.1.0

- 首个版本：提供 `exa_search` 工具，通过 Exa 搜索接口返回网页标题、网址与摘要。
- 使用驼峰参数 `numResults` 与 `contents.highlights`，请求官方语义检索接口。
- 端点与每次返回条数可在 `worlds.exa` 配置；密钥由宿主注入。
