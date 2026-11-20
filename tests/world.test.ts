/**
 * Exa World 的纯函数级测试：stub 全局 fetch，不联网、不启宿主。
 *
 * `dryMountWorld` / `fakeWorldContext` 在 cortico 0.2.16 的签名是
 * `(def, opts)` 与 `(def, opts)`，`opts.scratchDir` 必填，两者都返回 Promise / 需要完整
 * `WorldContext`；这里按真实签名调用，不再用 `{ sections: ... }` 之类的旧形状。
 *
 * 另锁一条真实返回结构：Exa 的响应是 `{ results: [{ title, url }] }`，默认不返回 snippet，
 * 工具必须照样把 title 与 url 交出来，且不能因为 snippet 缺失而抛错。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dryMountWorld, fakeWorldContext } from 'cortico/extensions/dry-mount.ts';
import type { ToolCallContext, ToolOutcome } from 'cortico/core/types.ts';
import { Exa } from '../src/definition.ts';
import { ExaWorld } from '../src/world.ts';
import { ExaDEFAULTS } from '../src/config.ts';

type FakeHost = { events: unknown[]; pushEvent: (e: unknown, opts?: unknown) => void | Promise<void> };

const packageDir = fileURLToPath(new URL('../', import.meta.url));
const TOOL_CTX = { role: 'test', log: {} } as unknown as ToolCallContext;

const scratchDirs: string[] = [];

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'exa-dry-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.unstubAllGlobals();
  while (scratchDirs.length) {
    rmSync(scratchDirs.pop() as string, { recursive: true, force: true });
  }
});

/** 捕获 fetch 的 URL 与 init，回一个固定的成功响应。 */
function stubFetch(payload: unknown) {
  const calls: Array<{ input: string; body: string; headers: Record<string, string> }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      input: String(input),
      body: String(init?.body ?? ''),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return { ok: true, status: 200, json: async () => payload } as unknown as Response;
  }));
  return calls;
}

describe('exa world', () => {
  it('a: dryMountWorld 不报 failures', async () => {
    const report = await dryMountWorld(Exa, { scratchDir: scratchDir(), packageDir });
    expect(report.failures).toEqual([]);
  });

  it('b: 构造 world，调用 start，断言推了 exa.started 且 origin 为 internal', async () => {
    const host: FakeHost = { events: [], pushEvent: (e) => { host.events.push(e); } };
    const ctx = fakeWorldContext(Exa, { scratchDir: scratchDir(), packageDir });
    Object.assign(ctx.cfg, { ...ExaDEFAULTS, enabled: true });
    const world = Exa.create(ctx);
    await world.start(host as unknown as never);
    const started = host.events.find((e) => (e as { type: string }).type === 'exa.started');
    expect(started).toBeDefined();
    expect((started as { origin: string }).origin).toBe('internal');
    expect((started as { senderKey: string }).senderKey).toBe('exa');
    await world.stop();
  });

  it('c: 搜索工具存在且可被调用，回执 text 里是 { results, provider: "exa" }', async () => {
    const key = 'test-key';
    const world = new ExaWorld({
      cfg: { ...ExaDEFAULTS },
      timezone: 'UTC',
      getApiKey: () => key,
    });
    const tool = world.tools().find((t) => t.name === 'exa_search');
    expect(tool).toBeDefined();

    const calls = stubFetch({ results: [{ title: '标题', url: 'https://example.com', snippet: '摘要' }] });
    const out = await tool!.handler({ query: '你好', max_results: 3 }, TOOL_CTX);

    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].body)).toMatchObject({ query: '你好', num_results: 3 });
    expect(calls[0].headers['x-api-key']).toBe(key);
    expect((out as ToolOutcome).text).toBe(JSON.stringify({
      results: [{ title: '标题', url: 'https://example.com', snippet: '摘要' }],
      provider: 'exa',
    }));
  });

  // 真实返回结构：Exa 默认不返回 snippet，缺 snippet 也要把 title / url 交出来并正常返回。
  it('handles the real Exa response { results: [{ title, url }] } without a snippet', async () => {
    const world = new ExaWorld({
      cfg: { ...ExaDEFAULTS },
      timezone: 'UTC',
      getApiKey: () => 'test-key',
    });
    const tool = world.tools().find((t) => t.name === 'exa_search')!;

    stubFetch({ requestId: 'req-1', results: [{ id: 'doc-1', title: 'Exa 文档', url: 'https://docs.exa.ai/reference' }] });
    const out = (await tool.handler({ query: 'exa api', max_results: 5 }, TOOL_CTX)) as ToolOutcome;

    expect(out.failed).toBeUndefined();
    expect(out.text).toContain('Exa 文档');
    expect(out.text).toContain('https://docs.exa.ai/reference');
    const parsed = JSON.parse(out.text) as { results: Array<{ title: string; url: string; snippet: string }>; provider: string };
    expect(parsed.provider).toBe('exa');
    expect(parsed.results).toEqual([{ title: 'Exa 文档', url: 'https://docs.exa.ai/reference', snippet: '' }]);
  });

  it('d: 配置修改后 endpoint 立即生效', async () => {
    const ctx = fakeWorldContext(Exa, { scratchDir: scratchDir(), packageDir });
    Object.assign(ctx.cfg, { ...ExaDEFAULTS, enabled: true, endpoint: 'https://api.exa.ai/search' });
    // create through definition to exercise ctx.persist
    const created = Exa.create(ctx);
    const varsBefore = (await created.envPromptVars()) ?? {};
    expect(varsBefore['exa.endpoint']).toBe('https://api.exa.ai/search');

    ctx.persist({ endpoint: 'https://custom.exa.ai/search' });
    expect(ctx.cfg.endpoint).toBe('https://custom.exa.ai/search');
    const varsAfter = (await created.envPromptVars()) ?? {};
    expect(varsAfter['exa.endpoint']).toBe('https://custom.exa.ai/search');

    await created.stop();
  });
});
