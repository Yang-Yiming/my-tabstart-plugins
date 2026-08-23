import type { WidgetSettingsSchema } from '@host/plugins/types'
import type { WidgetSettingValue, WidgetSettings } from '@host/plugins/widgetSettings'

export const TUNER_WIDGET_ID = 'liquid-glass-tuner'

/** Schema consumed by Settings → Widgets; defaults mirror the previous hardcoded values. */
export const glassSchema: WidgetSettingsSchema = {
  title: 'Liquid Glass (liquid-glass-react)',
  description: '调整液态玻璃主题的折射参数，保存后立即对全部面板生效。',
  fields: [
    {
      type: 'select',
      key: 'mode',
      label: '折射模式',
      description: 'shader 最精确但最不稳定；Safari/Firefox 下位移效果不可见。',
      options: [
        { value: 'standard', label: 'standard' },
        { value: 'polar', label: 'polar' },
        { value: 'prominent', label: 'prominent' },
        { value: 'shader', label: 'shader' },
      ],
      default: 'standard',
    },
    { type: 'number', key: 'displacementScale', label: '折射强度 displacementScale', min: 0, max: 300, step: 1, default: 130 },
    { type: 'number', key: 'blurAmount', label: '磨砂模糊 blurAmount', min: 0, max: 1, step: 0.01, default: 0.2 },
    { type: 'number', key: 'saturation', label: '饱和度 saturation (%)', min: 80, max: 250, step: 5, default: 130 },
    { type: 'number', key: 'aberrationIntensity', label: '色差 aberrationIntensity', min: 0, max: 10, step: 0.1, default: 2 },
    { type: 'number', key: 'cornerRadius', label: '圆角 cornerRadius (px)', min: 0, max: 48, step: 1, default: 24 },
  ],
}

const num = (value: WidgetSettingValue | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function glassParams(settings: WidgetSettings): {
  mode: 'standard' | 'polar' | 'prominent' | 'shader'
  displacementScale: number
  blurAmount: number
  saturation: number
  aberrationIntensity: number
  cornerRadius: number
} {
  const mode = String(settings.mode ?? 'standard')
  return {
    mode: (['standard', 'polar', 'prominent', 'shader'].includes(mode) ? mode : 'standard') as
      | 'standard'
      | 'polar'
      | 'prominent'
      | 'shader',
    displacementScale: num(settings.displacementScale, 130),
    blurAmount: num(settings.blurAmount, 0.2),
    saturation: num(settings.saturation, 130),
    aberrationIntensity: num(settings.aberrationIntensity, 2),
    cornerRadius: num(settings.cornerRadius, 24),
  }
}
