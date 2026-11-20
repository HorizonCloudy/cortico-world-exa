/**
 * Exa 世界：通过 Exa REST 接口做网络搜索，把结果以标题、网址、摘要的形式交给 bot 引用。
 *
 * 密钥 `EXA_API_KEY` 由宿主通过 secret 注入，世界本身不存密钥，也不把密钥写进配置文件。
 * 端点与结果条数可在配置节 `worlds.exa` 里调整，改完立即生效。
 */
import type { ToolDef, ToolOutcome, World, WorldHost, WorldWebUiDecl } from 'cortico/core/types.ts';
import { nowIso } from 'cortico/core/util.ts';
import { fileURLToPath } from 'node:url';
import { ExaCONFIG_GROUP, ExaDEFAULTS, type ExaConfigSection } from './config.ts';

const ENDPOINT_DEFAULT = 'https://api.exa.ai/search';

/** Exa 搜索工具的声明（不含 handler，由世界实例绑定）。 */
export const TOOL_DECLS: ReadonlyArray<Omit<ToolDef, 'handler'>> = [
  {
    name: 'exa_search',
    tags: ['read'],
    description: '用 Exa 搜索网页，返回每条结果的标题、网址和摘要，供 bot 在回答里引用。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'The search query.' },
        max_results: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 5,
          description: 'Maximum number of results to return.',
        },
      },
      required: ['query'],
    },
  },
];

/** 环境提示词文件，供 webUi 的 promptDocs 引用。 */
const ENV_PROMPT_FILE = fileURLToPath(new URL('./ENV_PROMPT.md', import.meta.url));

/** Exa 世界实例。 */
export class ExaWorld implements World {
  readonly id = 'exa';
  private host: WorldHost | null = null;

  constructor(private readonly opts: { cfg: ExaConfigSection; timezone: string; getApiKey: () => string | undefined; botDir?: string }) {}

  private keyHint(): string {
    const file = this.opts.botDir ? `${this.opts.botDir.replace(/[\\/]+$/, '')}/.env` : '部署目录的 .env 文件';
    return `请把 EXA_API_KEY=你的密钥 这一行加入 ${file}（一行一个，值不能含空格）。保存后下一次调用即生效，无需重启。`;
  }

  /** 环境提示词里暴露的变量。 */
  async envPromptVars(): Promise<Record<string, string>> {
    const envFile = this.opts.botDir ? `${this.opts.botDir.replace(/[\\/]+$/, '')}/.env` : '(未取到部署目录)';
    return { 'exa.endpoint': this.opts.cfg.endpoint ?? '(default)', 'exa.envFile': envFile };
  }

  /** 把搜索工具的 handler 绑定到这个世界实例。 */
  tools(): ToolDef[] {
    return [{ ...TOOL_DECLS[0], handler: this.searchHandler.bind(this) }];
  }

  /** 控制台面板：配置项组与环境提示词文档。 */
  webUi(): WorldWebUiDecl {
    return {
      config: [ExaCONFIG_GROUP],
      promptDocs: [{
        key: 'worlds.exa.envPrompt',
        title: 'Exa 环境',
        description: 'Exa 搜索所用的端点与最大结果条数。',
        path: ENV_PROMPT_FILE,
        role: 'envPrompt',
        vars: [
          { name: 'exa.endpoint', description: 'Exa 搜索接口的地址，空时使用内置默认值。' },
          { name: 'exa.envFile', description: '密钥文件 .env 的准确路径，用于回答用户「密钥填哪里」。' },
        ],
      }],
    };
  }

  /** 挂载后推一次 exa.started 事件。 */
  async start(host: WorldHost): Promise<void> {
    this.host = host;
    await host.pushEvent({
      type: 'exa.started',
      source: this.id,
      senderKey: this.id,
      ts: nowIso(this.opts.timezone),
      text: 'exa 已就绪。',
      origin: 'internal',
    }, { trigger: 'flush' });
  }

  /** 卸载：只放掉对宿主的引用。 */
  async stop(): Promise<void> {
    this.host = null;
  }

  /** 执行一次 Exa 搜索，把结果归一化后返回。 */
  private async searchHandler(args: Record<string, unknown>): Promise<ToolOutcome> {
    const query = typeof args.query === 'string' ? args.query : '';
    const maxResults = typeof args.max_results === 'number' && Number.isFinite(args.max_results)
      ? Math.max(1, Math.min(10, args.max_results))
      : ExaDEFAULTS.maxResults;

    const key = this.opts.getApiKey();
    if (!key) {
      throw new Error(`缺少 Exa 密钥。${this.keyHint()}`);
    }

    const res = await fetch(this.opts.cfg.endpoint ?? ENDPOINT_DEFAULT, {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ query, num_results: maxResults }),
    });
    if (!res.ok) throw new Error(`exa 搜索失败：HTTP ${res.status}`);

    const data = await res.json();
    const raw = data?.results ?? data?.items ?? [];
    const list = Array.isArray(raw) ? raw : [];
    const results = list.map((item: Record<string, unknown>) => {
      const title = typeof item.title === 'string' ? item.title : (typeof item.url === 'string' ? item.url : '');
      const url = typeof item.url === 'string' ? item.url : '';
      const snippet = typeof item.snippet === 'string' ? item.snippet
        : (typeof item.content === 'string' ? item.content : (typeof item.summary === 'string' ? item.summary : ''));
      return { title, url, snippet };
    });
    return { text: JSON.stringify({ results, provider: 'exa' }) };
  }
}
