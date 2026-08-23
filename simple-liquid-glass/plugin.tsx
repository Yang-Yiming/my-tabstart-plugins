import { lazy } from 'react'
import type { HomepageContext } from '@host/plugins/runtime'
import { defineWidgetPlugin } from '@host/plugins/runtime'
import type { WidgetDescriptor } from '@host/plugins/types'
import { glassSchema, TUNER_WIDGET_ID } from './tuner'

const liquidGlassSurface = lazy(() =>
  import('./LiquidGlassSurface').then((module) => ({ default: module.LiquidGlassSurface })),
)

// Warm the lazy chunk at plugin load time: the surface is used by every themed
// panel, so deferring the fetch until the first panel mounts makes that mount
// suspend — and without it, opening Settings for the first time would flash
// the plain panel while the liquid-glass effect warms up.
void import('./LiquidGlassSurface')

const tunerWidget: WidgetDescriptor = {
  id: TUNER_WIDGET_ID,
  name: 'Simple Liquid Glass',
  group: 'Plugins',
  description: 'simple-liquid-glass 主题的实时预览卡；参数在 Settings → Widgets 中调整。卡片会标注该主题是否为当前激活主题。',
  component: lazy(() => import('./TunerWidget').then((module) => ({ default: module.TunerWidget }))),
  defaultW: 2,
  defaultH: 2,
  minW: 1,
  minH: 1,
  order: 201,
  settings: glassSchema,
}

export const plugins = [
  {
    id: 'simple-liquid-glass',
    name: 'Simple Liquid Glass',
    description: '使用 simple-liquid-glass 为 widget 表面提供真实折射与毛玻璃质感。',
    builtin: false,
    order: 200,
    apply(ctx: HomepageContext) {
      ctx.effect(() =>
        ctx.themes.register({
          id: 'simple-liquid-glass',
          name: 'Simple Liquid Glass',
          description: '使用 simple-liquid-glass 的液态玻璃主题。',
          rootClass: 'theme-simple-liquid-glass',
          surface: liquidGlassSurface,
          tokens: {
            '--chrome-button-bg': 'rgba(255, 255, 255, 0.12)',
            '--chrome-button-border': 'rgba(255, 255, 255, 0.28)',
            '--chrome-button-text': 'rgba(255, 255, 255, 0.92)',
            '--chrome-button-hover-bg': 'rgba(255, 255, 255, 0.20)',
            '--chrome-button-hover-text': 'rgba(255, 255, 255, 1)',
            '--chrome-panel-bg': 'rgba(24, 30, 48, 0.55)',
            '--chrome-panel-border': 'rgba(255, 255, 255, 0.16)',
            '--chrome-panel-blur': '36px',
            '--search-shell-bg': 'linear-gradient(90deg, rgba(255, 255, 255, 0.18), rgba(180, 220, 255, 0.18))',
            '--search-shell-border': 'rgba(255, 255, 255, 0.35)',
            '--search-shell-blur': '32px',
            '--search-shell-shadow': '0 12px 44px -12px rgba(0, 0, 0, 0.38)',
            '--search-shell-hover-border': 'rgba(255, 255, 255, 0.5)',
            '--search-shell-hover-shadow': '0 24px 60px -14px rgba(0, 0, 0, 0.45)',
            '--search-popover-bg': 'rgba(24, 30, 48, 0.5)',
            '--search-popover-border': 'rgba(255, 255, 255, 0.18)',
            '--search-popover-blur': '32px',
            '--clock-time-text': 'rgba(255, 255, 255, 0.96)',
            '--clock-date-text': 'rgba(255, 255, 255, 0.78)',
          },
          css: `
            [data-theme='simple-liquid-glass'] body {
              background-color: #0b1220;
            }
            [data-theme='simple-liquid-glass'] .chrome-button,
            [data-theme='simple-liquid-glass'] .chrome-panel {
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
            }
            [data-theme='simple-liquid-glass'] .settings-sidebar {
              background: rgba(28, 36, 52, 0.42) !important;
              border-color: rgba(255, 255, 255, 0.12) !important;
            }
            [data-theme='simple-liquid-glass'] .settings-panel .text-slate-900 {
              color: rgba(255, 255, 255, 0.92) !important;
            }
            [data-theme='simple-liquid-glass'] .settings-panel .text-slate-600 {
              color: rgba(255, 255, 255, 0.62) !important;
            }
            [data-theme='simple-liquid-glass'] .settings-panel .text-slate-800 {
              color: rgba(255, 255, 255, 0.84) !important;
            }
            [data-theme='simple-liquid-glass'] .react-grid-placeholder {
              border-color: rgba(255, 255, 255, 0.35) !important;
              background: rgba(255, 255, 255, 0.18) !important;
            }
          `,
        }),
      )
    },
  },
  defineWidgetPlugin(tunerWidget),
]
