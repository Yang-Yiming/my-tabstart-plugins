import type { WidgetSettingsSchema } from '@host/plugins/types'
import type { WidgetSettingValue, WidgetSettings } from '@host/plugins/widgetSettings'

export const TUNER_WIDGET_ID = 'simple-liquid-glass-tuner'

export type SimpleGlassLens = 'classic' | 'convex' | 'shift' | 'rim'

export const glassSchema: WidgetSettingsSchema = {
  title: 'Simple Liquid Glass (simple-liquid-glass)',
  description: '调整液态玻璃主题的折射参数，保存后立即对全部面板生效。',
  fields: [
    { type: 'number', key: 'displacementScale', label: '折射强度 displacementScale', min: 0, max: 200, step: 1, default: 70 },
    { type: 'number', key: 'aberrationIntensity', label: '色差 aberrationIntensity', min: 0, max: 10, step: 0.1, default: 3 },
    {
      type: 'select',
      key: 'lens',
      label: '透镜模式 lens',
      options: [
        { value: 'classic', label: 'classic' },
        { value: 'convex', label: 'convex' },
        { value: 'shift', label: 'shift' },
        { value: 'rim', label: 'rim' },
      ],
      default: 'rim',
    },
    { type: 'number', key: 'blur', label: '磨砂模糊 blur (px)', min: 0, max: 30, step: 1, default: 8 },
    { type: 'number', key: 'saturation', label: '饱和度 saturation (%)', min: 80, max: 250, step: 5, default: 125 },
    { type: 'number', key: 'frost', label: '磨砂强度 frost', min: 0, max: 1, step: 0.02, default: 0.32 },
    { type: 'number', key: 'radius', label: '圆角 radius (px)', min: 0, max: 40, step: 1, default: 24 },
  ],
}

const num = (value: WidgetSettingValue | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function glassParams(settings: WidgetSettings): {
  displacementScale: number
  aberrationIntensity: number
  lens: SimpleGlassLens
  blur: number
  saturation: number
  frost: number
  radius: number
} {
  const lens = String(settings.lens ?? 'rim')
  return {
    displacementScale: num(settings.displacementScale, 70),
    aberrationIntensity: num(settings.aberrationIntensity, 3),
    lens: (['classic', 'convex', 'shift', 'rim'].includes(lens) ? lens : 'rim') as SimpleGlassLens,
    blur: num(settings.blur, 8),
    saturation: num(settings.saturation, 125),
    frost: num(settings.frost, 0.32),
    radius: num(settings.radius, 24),
  }
}
