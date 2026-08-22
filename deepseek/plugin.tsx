import { lazy } from 'react'
import { defineWidgetPlugin } from '@host/plugins/runtime'
import type { WidgetDescriptor } from '@host/plugins/types'

const widget: WidgetDescriptor = {
  id: 'deepseek',
  name: 'DeepSeek Balance',
  group: 'Plugins',
  description: 'DeepSeek API 余额（GET /user/balance），写死的官方插件，无需配置 URL / 行定义。',
  component: lazy(() => import('./DeepSeekWidget').then((m) => ({ default: m.DeepSeekWidget }))),
  defaultW: 2,
  defaultH: 2,
  minW: 1,
  minH: 1,
  order: 100,
  settings: {
    title: 'DeepSeek Balance',
    description: '只需填 API Key 即可。密钥只保存在本机浏览器，不会回显。',
    fields: [
      {
        type: 'text',
        key: 'title',
        label: '标题',
        description: '卡片标题，留空则显示 DeepSeek。',
        default: 'DeepSeek',
      },
      {
        type: 'password',
        key: 'apiKey',
        label: 'API Key',
        description: '仅保存在本机浏览器，不会回显。',
        default: '',
      },
      {
        type: 'number',
        key: 'refreshMinutes',
        label: '自动刷新间隔 (分钟)',
        description: '0 = 仅手动刷新。',
        min: 0,
        max: 1440,
        step: 5,
        default: 30,
      },
      {
        type: 'boolean',
        key: 'peakReminder',
        label: '高峰提醒',
        description: '在 09:00–12:00 与 14:00–18:00 给卡片加琥珀色描边和 Peak 徽章。',
        default: true,
      },
    ],
  },
}

export const plugins = [defineWidgetPlugin(widget)]
