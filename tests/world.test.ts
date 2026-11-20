/** vitest：dryMountWorld / fakeWorldContext / Exa definition。 */
import { describe, expect, it, vi } from 'vitest';
import { dryMountWorld, fakeWorldContext } from 'cortico/extensions/dry-mount.ts';
import { Exa } from '../src/definition.ts';
import { ExaWorld } from '../src/world.ts';
import { ExaDEFAULTS } from '../src/config.ts';

type FakeHost = { events: unknown[]; pushEvent: (e: unknown) => void | Promise<void> };

describe('exa world', () => {
  it('a: dryMountWorld 不报 failures', () => {
    const mount = dryMountWorld(Exa);
    expect(mount.failures).toEqual([]);
  });

  it('b: 构造 world，调用 start，断言推了 exa.started 且 origin 为 internal', async () => {
    const host: FakeHost = { events: [], pushEvent: (e) => { host.events.push(e); } };
    const ctx = fakeWorldContext({ sections: { exa: { ...ExaDEFAULTS } } });
    const world = Exa.create(ctx);
    await world.start(host as unknown as never);
    const started = host.events.find((e) => (e as { type: string }).type === 'exa.started');
    expect(started).toBeDefined();
    expect((started as { origin: string }).origin).toBe('internal');
    expect((started as { senderKey: string }).senderKey).toBe('exa');
    await world.stop();
  });

  it('c: 搜索工具存在且可被调用，返回 { results, provider: "exa" }', async () => {
    const key = 'test-key';
    const world = new ExaWorld({
      cfg: { ...ExaDEFAULTS },
      timezone: 'UTC',
      getApiKey: () => key,
    });
    const tools = world.tools();
    expect(tools.find((t) => t.name === 'exa_search')).toBeDefined();

    const fetched: unknown[] = [];
    const response = { ok: true, status: 200, json: async () => ({ results: [{ title: '标题', url: 'https://example.com', snippet: '摘要' }] }) };
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      fetched.push({ input, init });
      return response as unknown as Response;
    }) as unknown as typeof fetch;

    const handler = tools.find((t) => t.name === 'exa_search')!.handler!;
    const out = await handler({ query: '你好', max_results: 3 });

    expect(fetched).toHaveLength(1);
    const body = JSON.parse((fetched[0] as { init: { body: string } }).init.body);
    expect(body.query).toBe('你好');
    expect(body.num_results).toBe(3);
    expect((fetched[0] as { init: { headers: Record<string, string> } }).init.headers['x-api-key']).toBe(key);
    expect(out).toEqual({ text: JSON.stringify({ results: [{ title: '标题', url: 'https://example.com', snippet: '摘要' }], provider: 'exa' }) });
  });

  it('d: 配置修改后 endpoint 立即生效', async () => {
    const cfg = { ...ExaDEFAULTS, endpoint: 'https://api.exa.ai/search' };
    const ctx = fakeWorldContext({
      sections: { exa: cfg },
      persist: (patch: Record<string, unknown>) => { Object.assign(cfg, patch); },
    });
    // create through definition to exercise ctx.persist
    const created = Exa.create(ctx);
    const varsBefore = await created.envPromptVars();
    expect(varsBefore['exa.endpoint']).toBe('https://api.exa.ai/search');

    ctx.persist({ endpoint: 'https://custom.exa.ai/search' });
    const varsAfter = await created.envPromptVars();
    expect(varsAfter['exa.endpoint']).toBe('https://custom.exa.ai/search');

    await created.stop();
  });
});
