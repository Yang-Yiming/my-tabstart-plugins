import type { WidgetSettingsSchema } from '@host/plugins/types'
import type { WidgetSettingValue, WidgetSettings } from '@host/plugins/widgetSettings'

export const TUNER_WIDGET_ID = 'glass-effect-tuner'

const LENS_MODES = ['classic', 'convex', 'rim', 'shift'] as const
export type LensEngine = 'lens' | 'lgr' | 'noise'

export const glassSchema: WidgetSettingsSchema = {
  title: 'Glass Effect',
  description: '调整液态玻璃主题的折射参数，保存后立即对全部面板生效。',
  fields: [
    {
      type: 'select',
      key: 'engine',
      label: '折射引擎 engine',
      description:
        'lens = simple-liquid-glass 参数化相图；lgr = liquid-glass-react 硬编码静态相图（仅 Chromium 生效）；noise = feTurbulence 程序化噪声（自研回退）。',
      options: [
        { value: 'lens', label: 'lens — SLG 参数化相图' },
        { value: 'lgr', label: 'lgr — LGR 硬编码相图' },
        { value: 'noise', label: 'noise — feTurbulence 噪声场' },
      ],
      default: 'lens',
    },
    {
      type: 'select',
      key: 'lensMode',
      label: '相图模式 lensMode',
      description: 'classic = 边缘折射；convex = 整面凸透镜；rim = 仅边缘环带；shift = 整体平移。',
      options: [
        { value: 'classic', label: 'classic — 边缘弯曲' },
        { value: 'convex', label: 'convex — 凸透镜' },
        { value: 'rim', label: 'rim — 边缘环带' },
        { value: 'shift', label: 'shift — 定向平移' },
      ],
      default: 'classic',
      showWhen: (settings) => settings.engine === 'lens',
    },
    {
      type: 'select',
      key: 'lgrMode',
      label: '静态相图 lgrMode',
      description: 'liquid-glass-react 内置的三张固定位移贴图，拉伸铺满元素。',
      options: [
        { value: 'standard', label: 'standard — 标准折射' },
        { value: 'polar', label: 'polar — 径向折射' },
        { value: 'prominent', label: 'prominent — 增强折射' },
      ],
      default: 'standard',
      showWhen: (settings) => settings.engine === 'lgr',
    },
    {
      type: 'number',
      key: 'displacementScale',
      label: '折射强度 displacementScale',
      min: 0,
      max: 300,
      step: 1,
      default: 70,
    },
    { type: 'number', key: 'aberrationIntensity', label: '色差 aberrationIntensity', min: 0, max: 10, step: 0.1, default: 3 },
    {
      type: 'number',
      key: 'lensStrength',
      label: '透镜强度 lensStrength',
      description: '相图场的额外幅度系数，1 为上游默认。',
      min: 0,
      max: 2,
      step: 0.05,
      default: 1,
      showWhen: (settings) => settings.engine === 'lens',
    },
    { type: 'number', key: 'blur', label: '磨砂模糊 blur (px)', min: 0, max: 30, step: 1, default: 8 },
    { type: 'number', key: 'saturation', label: '饱和度 saturation (%)', min: 80, max: 250, step: 5, default: 125 },
    { type: 'number', key: 'frost', label: '磨砂强度 frost', min: 0, max: 1, step: 0.02, default: 0.32 },
    { type: 'number', key: 'radius', label: '圆角 radius (px)', min: 0, max: 40, step: 1, default: 24 },
    {
      type: 'boolean',
      key: 'refraction',
      label: '折射 refraction',
      description:
        '关闭后滤镜链只保留磨砂模糊，去掉 SVG 相图（feImage/feDisplacementMap）。实测滚动时单帧 GPU 成本约降至 1/3，代价是没有边缘弯曲与色差。',
      default: true,
    },
  ],
}

const num = (value: WidgetSettingValue | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const str = <T extends string>(value: WidgetSettingValue | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

export function glassParams(settings: WidgetSettings): {
  engine: LensEngine
  lensMode: (typeof LENS_MODES)[number]
  lgrMode: 'standard' | 'polar' | 'prominent'
  displacementScale: number
  aberrationIntensity: number
  lensStrength: number
  blur: number
  saturation: number
  frost: number
  radius: number
  refraction: boolean
} {
  return {
    engine: str(settings.engine, ['lens', 'lgr', 'noise'] as const, 'lens'),
    lensMode: str(settings.lensMode, LENS_MODES, 'classic'),
    lgrMode: str(settings.lgrMode, ['standard', 'polar', 'prominent'] as const, 'standard'),
    displacementScale: num(settings.displacementScale, 70),
    aberrationIntensity: num(settings.aberrationIntensity, 3),
    lensStrength: num(settings.lensStrength, 1),
    blur: num(settings.blur, 8),
    saturation: num(settings.saturation, 125),
    frost: num(settings.frost, 0.32),
    radius: num(settings.radius, 24),
    refraction: settings.refraction !== false,
  }
}