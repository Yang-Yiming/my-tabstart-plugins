import { lazy } from 'react'
import type { HomepageContext } from '@host/plugins/runtime'
import { defineWidgetPlugin } from '@host/plugins/runtime'
import type { WidgetDescriptor } from '@host/plugins/types'
import { glassSchema, TUNER_WIDGET_ID } from './tuner'

const liquidGlassSurface = lazy(() =>
  import('./LiquidGlassSurface').then((module) => ({ default: module.LiquidGlassSurface })),
)

// Warm the lazy chunk at plugin load time so themed panels don't suspend on
// first mount (same trick as the simple-liquid-glass theme).
void import('./LiquidGlassSurface')

const tunerWidget: WidgetDescriptor = {
  id: TUNER_WIDGET_ID,
  name: 'Liquid Glass',
  group: 'Plugins',
  description: 'liquid-glass-react 主题的实时预览卡；参数在 Settings → Widgets 中调整。卡片会标注该主题是否为当前激活主题。',
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
    id: 'liquid-glass',
    name: 'Liquid Glass',
    description: '使用 liquid-glass-react 为 widget 表面提供折射、色差与边缘高光效果。',
    builtin: false,
    order: 200,
    apply(ctx: HomepageContext) {
      ctx.effect(() =>
        ctx.themes.register({
          id: 'liquid-glass',
          name: 'Liquid Glass',
          description: '使用 liquid-glass-react 的液态玻璃主题。',
          rootClass: 'theme-liquid-glass',
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
            [data-theme='liquid-glass'] body {
              background-color: #0b1220;
            }
            [data-theme='liquid-glass'] .chrome-button,
            [data-theme='liquid-glass'] .chrome-panel {
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
            }
            /* The inner .glass layer shrink-wraps its content; stretch it to fill
               the surface wrapper so the effect covers the whole panel. */
            .liquid-glass-react-surface > .glass {
              width: 100%;
              height: 100%;
            }
            /* The library animates glassSize from a 270x69 default to the measured
               panel size on every mount (plus hover scale/elastic transitions).
               That showed up as a phantom liquid animation whenever a surface
                (e.g. the search bar) mounted. Kill all of them. */
            .lgx-backdrop,
            .lgx-backdrop * {
              transition: none !important;
              animation: none !important;
            }
            /* The warp span only blurs/saturates; refraction is wired onto .glass
               by the surface component instead. Neutralize the warp entirely to
               avoid double-applying blur/saturation. */
            .lgx-backdrop .glass__warp {
              filter: none !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
            [data-theme='liquid-glass'] .settings-sidebar {
              background: rgba(28, 36, 52, 0.42) !important;
              border-color: rgba(255, 255, 255, 0.12) !important;
            }
            [data-theme='liquid-glass'] .settings-panel .text-slate-900 {
              color: rgba(255, 255, 255, 0.92) !important;
            }
            [data-theme='liquid-glass'] .settings-panel .text-slate-600 {
              color: rgba(255, 255, 255, 0.62) !important;
            }
            [data-theme='liquid-glass'] .settings-panel .text-slate-800 {
              color: rgba(255, 255, 255, 0.84) !important;
            }
            [data-theme='liquid-glass'] .react-grid-placeholder {
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

