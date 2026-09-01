import { lazy } from 'react'
import { defineWidgetPlugin } from '@host/plugins/runtime'
import type { WidgetDescriptor, WidgetSettingsSchema } from '@host/plugins/types'

const smallComponent = lazy(() =>
  import('./WeatherWidget').then((m) => ({ default: m.WeatherSmallWidget })),
)
const mediumComponent = lazy(() =>
  import('./WeatherWidget').then((m) => ({ default: m.WeatherWidget })),
)
const largeComponent = lazy(() =>
  import('./WeatherWidget').then((m) => ({ default: m.WeatherLargeWidget })),
)

const weatherSettings: WidgetSettingsSchema = {
  title: 'Weather',
  description: '数据来自 Open-Meteo（免费、无需 API Key）。位置优先使用浏览器定位，失败或被拒时回退到城市名。',
  fields: [
    {
      type: 'text',
      key: 'city',
      label: '城市',
      description: '定位不可用 / 被拒绝时使用的城市名，支持中文（如 上海、杭州）。',
      default: '北京',
    },
    {
      type: 'boolean',
      key: 'useGeolocation',
      label: '浏览器自动定位',
      description: '开启后优先用浏览器定位（仅取经纬度，不会上传），失败时回退到上面的城市。',
      default: true,
    },
    {
      type: 'number',
      key: 'refreshMinutes',
      label: '自动刷新间隔 (分钟)',
      description: '0 = 仅手动刷新。',
      min: 0,
      max: 360,
      step: 5,
      default: 30,
    },
  ],
}

const weatherMedium: WidgetDescriptor = {
  id: 'weather',
  name: 'Weather',
  group: 'Weather',
  description: '当前天气、温度、降水量与未来几小时降水概率（Open-Meteo）。',
  component: mediumComponent,
  defaultW: 2,
  defaultH: 2,
  minW: 2,
  minH: 1,
  order: 105,
  settings: weatherSettings,
}

const weatherSmall: WidgetDescriptor = {
  id: 'weather-small',
  name: 'Weather (Small)',
  group: 'Weather',
  description: '极简天气：图标 + 温度 + 天气描述，可点击展开大卡片。',
  component: smallComponent,
  defaultW: 1,
  defaultH: 1,
  minW: 1,
  minH: 1,
  order: 106,
  expandTo: 'weather-large',
  settings: weatherSettings,
}

const weatherLarge: WidgetDescriptor = {
  id: 'weather-large',
  name: 'Weather (Large)',
  group: 'Weather',
  description: '完整天气：当前状况、降水量、逐小时降水概率与 5 天预报。',
  component: largeComponent,
  defaultW: 4,
  defaultH: 2,
  minW: 3,
  minH: 2,
  order: 107,
  settings: weatherSettings,
}

export const plugins = [
  defineWidgetPlugin(weatherMedium),
  defineWidgetPlugin(weatherSmall),
  defineWidgetPlugin(weatherLarge),
]
