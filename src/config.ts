/** Exa 世界的配置节 `worlds.exa`、默认值与控制台配置项。 */
import type { ConfigGroup, WorldSection } from 'cortico/core/types.ts';

export const EXA_ID = 'exa';

/** `worlds.exa` 配置节。 */
export interface ExaConfigSection extends WorldSection {
  /** Exa 搜索端点；空时使用内置默认值。 */
  endpoint?: string;
  /** 每次搜索最多返回的结果条数，1–10。 */
  maxResults: number;
}

/** `worlds.exa` 的默认值。 */
export const ExaDEFAULTS: ExaConfigSection = {
  enabled: false,
  endpoint: 'https://api.exa.ai/search',
  maxResults: 5,
};

const K = `worlds.${EXA_ID}`;

/** 控制台里 `worlds.exa` 的配置项组。 */
export const ExaCONFIG_GROUP: ConfigGroup = {
  id: `world:${EXA_ID}`,
  owner: `world:${EXA_ID}`,
  schema: {
    type: 'object',
    title: 'Exa 网络搜索',
    properties: {
      [`${K}.endpoint`]: {
        type: 'string',
        title: '搜索端点',
        description: 'Exa 搜索接口的地址，空时使用内置默认值。',
      },
      [`${K}.maxResults`]: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        title: '最大结果数',
        description: '每次搜索最多返回的结果条数。',
      },
    },
  },
};
