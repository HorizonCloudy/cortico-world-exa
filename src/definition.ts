/** Exa 世界的定义：id `exa`，暴露 `exa_search` 搜索工具。 */
import { describeTools, type WorldDefinition, type WorldDescribe } from 'cortico/world.ts';
import { ExaCONFIG_GROUP, ExaDEFAULTS, type ExaConfigSection } from './config.ts';
import { ExaWorld, TOOL_DECLS } from './world.ts';

/** 每个工具在中英文里的说明。 */
const TOOL_DESC = {
  exa_search: {
    zh: '用 Exa 搜索网页，返回标题、网址和摘要。',
    en: 'Searches the web with Exa, returning titles, URLs and snippets.',
  },
};

const DESCRIBE: WorldDescribe = {
  tools: describeTools(TOOL_DECLS, TOOL_DESC),
  events: [
    {
      type: 'exa.started',
      description: { zh: '世界已挂载。', en: 'The world was mounted.' },
    },
  ],
};

export function exaDefinition(): WorldDefinition<ExaConfigSection> {
  return {
    id: 'exa',
    label: 'exa',
    defaults: () => structuredClone(ExaDEFAULTS),
    create: (ctx) => new ExaWorld({
      cfg: ctx.cfg,
      timezone: ctx.timezone,
      getApiKey: () => ctx.secret('EXA_API_KEY'),
    }),
    describe: DESCRIBE,
  };
}

export const Exa = exaDefinition();
