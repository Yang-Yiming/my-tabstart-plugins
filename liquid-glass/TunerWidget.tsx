import { WidgetCard } from '@host/components/WidgetCard'
import { useActiveTheme } from '@host/plugins/hooks'
import type { WidgetProps } from '@host/plugins/types'
import { useWidgetSettings } from '@host/plugins/widgetSettings'
import { glassSchema, glassParams, TUNER_WIDGET_ID } from './tuner'

const formatValue = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(2))

export function TunerWidget({ widgetKey }: WidgetProps) {
  const { settings } = useWidgetSettings(widgetKey ?? TUNER_WIDGET_ID)
  const params = glassParams(settings)
  const { activeThemeId } = useActiveTheme()
  const active = activeThemeId === 'liquid-glass'

  const rows: Array<[string, string]> = [
    ['mode', params.mode],
    ['displacement', formatValue(params.displacementScale)],
    ['blur', formatValue(params.blurAmount)],
    ['saturation', `${formatValue(params.saturation)}%`],
    ['aberration', formatValue(params.aberrationIntensity)],
    ['radius', `${formatValue(params.cornerRadius)}px`],
  ]

  return (
    <WidgetCard className="flex h-full flex-col justify-between gap-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Liquid Glass</p>
          <span
            className={
              active
                ? 'rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-200'
                : 'rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50'
            }
          >
            {active ? '当前主题' : '主题未激活'}
          </span>
        </div>
        <p className="mt-1 text-sm text-white/85">
          {active ? '在 Settings → Widgets 中调整参数，所有面板即时生效。' : '该主题当前未激活——请先在 Settings → Appearance 中切换到此主题，否则调参不会有可见效果。'}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/70">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-2">
            <dt className="text-white/45">{key}</dt>
            <dd className="font-mono text-white/85">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] leading-snug text-white/40">{glassSchema.description}</p>
    </WidgetCard>
  )
}
