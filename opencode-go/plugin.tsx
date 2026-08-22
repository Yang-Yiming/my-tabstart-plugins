import { lazy } from 'react'
import { defineWidgetPlugin } from '@host/plugins/runtime'
import type { WidgetDescriptor } from '@host/plugins/types'

const widget: WidgetDescriptor = {
  id: 'opencode-go',
  name: 'OpenCode Go',
  group: 'Plugins',
  description: 'OpenCode Go 订阅用量（GET /zen/go/v1/usage），显示 5 小时 / 每周 / 每月额度与重置倒计时。',
  component: lazy(() => import('./OpenCodeGoWidget').then((m) => ({ default: m.OpenCodeGoWidget }))),
  defaultW: 2,
  defaultH: 2,
  minW: 1,
  minH: 1,
  order: 101,
  settings: {
    title: 'OpenCode Go',
    description: '只需填入 OpenCode Go API Key。密钥只保存在本机浏览器，不会回显。',
    fields: [
      {
        type: 'text',
        key: 'title',
        label: '标题',
        description: '卡片标题，留空则显示 OpenCode Go。',
        default: 'OpenCode Go',
      },
      {
        type: 'password',
        key: 'apiKey',
        label: 'API Key',
        description: '可在 OpenCode 的 auth.json 中 opencode-go 条目里找到。仅保存在本机浏览器。',
        default: '',
      },
      {
        type: 'number',
        key: 'refreshMinutes',
        label: '自动刷新间隔 (分钟)',
        description: '0 = 仅手动刷新。5 小时窗口较短，建议 15 分钟。',
        min: 0,
        max: 1440,
        step: 5,
        default: 15,
      },
      {
        type: 'boolean',
        key: 'peakReminder',
        label: 'Deepseek 高峰提醒',
        description: '在 09:00–12:00 与 14:00–18:00 给卡片加琥珀色描边和 Peak 徽章。',
        default: true,
      },
      {
        type: 'boolean',
        key: 'showRolling',
        label: '显示 5 小时窗口',
        default: true,
      },
      {
        type: 'boolean',
        key: 'showWeekly',
        label: '显示每周窗口',
        default: true,
      },
      {
        type: 'boolean',
        key: 'showMonthly',
        label: '显示每月窗口',
        default: true,
      },
    ],
  },
}

export const plugins = [defineWidgetPlugin(widget)]
