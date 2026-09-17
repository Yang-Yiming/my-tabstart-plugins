import { lazy } from 'react'
import { ACTIVE_THEME_KEY } from '@host/plugins/hooks'
import type { HomepageContext } from '@host/plugins/runtime'
import { defineWidgetPlugin } from '@host/plugins/runtime'
import type { WidgetDescriptor } from '@host/plugins/types'
import { storageArea } from '@host/lib/storage'
import { glassSchema, TUNER_WIDGET_ID } from './tuner'

const GLASS_THEME_ID = 'glass-effect'

/**
 * Chunk-split on purpose: the surface carries the vendored displacement maps
 * (~34 kB gzip), so it must not be folded into the entry bundle. A static
 * import here would undo that, which is why the specifier is loaded lazily and
 * both consumers below share this one loader.
 */
const loadLiquidGlassSurface = () => import('./LiquidGlassSurface')

const liquidGlassSurface = lazy(() =>
  loadLiquidGlassSurface().then((module) => ({ default: module.LiquidGlassSurface })),
)

/**
 * Warm the surface chunk when — and only when — this theme is the selected one.
 *
 * The chunk is used by every themed panel, so deferring the fetch until the
 * first panel mounts makes that mount suspend: without a warm module, opening
 * Settings while this theme is active shows the plain panel first. But warming
 * it unconditionally at plugin load (which is what this used to do) makes every
 * new tab parse those maps for users who never select the theme, so this gate
 * is what keeps the warm-up free for everyone else. The read goes through the
 * host storage abstraction, so it works against both localStorage and
 * chrome.storage.
 */
async function preloadSurfaceWhenSelected() {
  const activeThemeId = await storageArea.get<string>(ACTIVE_THEME_KEY)
  if (activeThemeId === GLASS_THEME_ID) await loadLiquidGlassSurface()
}

void preloadSurfaceWhenSelected().catch(() => {})

const tunerWidget: WidgetDescriptor = {
  id: TUNER_WIDGET_ID,
  name: 'Glass Effect',
  group: 'Plugins',
  description: 'Glass Effect 主题的实时预览卡；参数在 Settings → Widgets 中调整。卡片会标注该主题是否为当前激活主题。',
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
    id: 'glass-effect',
    name: 'Glass Effect',
    description: '为 widget 表面提供真实折射与毛玻璃质感（相图 / 噪声双引擎）。',
    builtin: false,
    order: 200,
    apply(ctx: HomepageContext) {
      ctx.effect(() =>
        ctx.themes.register({
          id: 'glass-effect',
          name: 'Glass Effect',
          description: '自研的液态玻璃主题：参数化相图（SLG）或 feTurbulence 噪声双引擎折射 + 毛玻璃。',
          rootClass: 'theme-glass-effect',
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
            [data-theme='glass-effect'] body {
              background-color: #0b1220;
            }
            [data-theme='glass-effect'] .chrome-button,
            [data-theme='glass-effect'] .chrome-panel {
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
            }
            [data-theme='glass-effect'] .settings-sidebar {
              background: rgba(28, 36, 52, 0.42) !important;
              border-color: rgba(255, 255, 255, 0.12) !important;
            }
            [data-theme='glass-effect'] .settings-panel .text-slate-900 {
              color: rgba(255, 255, 255, 0.92) !important;
            }
            [data-theme='glass-effect'] .settings-panel .text-slate-600 {
              color: rgba(255, 255, 255, 0.62) !important;
            }
            [data-theme='glass-effect'] .settings-panel .text-slate-800 {
              color: rgba(255, 255, 255, 0.84) !important;
            }
            [data-theme='glass-effect'] .react-grid-placeholder {
              border-color: rgba(255, 255, 255, 0.35) !important;
              background: rgba(255, 255, 255, 0.18) !important;
            }

            /*
             * The theme already renders the surfaces as real glass; the host's
             * own frosted chrome on top of it is a *second* backdrop-filter
             * element per control. That matters because the cost is per element,
             * not per area: each one gets its own render surface and Skia
             * saveLayer, re-evaluated whenever anything behind it is damaged.
             * Measured on this app: three 38x38 buttons + one 122x36 control +
             * three 30x30 hover buttons are ~1% of the glass area but ~21% of
             * the scroll cost. They also sit *above* the glass panels, so they
             * re-filter against already-filtered content.
             *
             * Neutralizing them is visually near-neutral (buttons keep their
             * translucent fill; measured mean colour shift <0.5/255) because the
             * backdrop behind them is a smooth wallpaper, not detail.
             *
             * Two of the selectors are Tailwind utilities, which the theme can
             * target by class name: backdrop-blur-md is the heatmap's
             * segmented control, and -right-2/-top-2 is the widget expand button
             * (invisible until hover, but composited regardless). The offsets
             * are scoped to this theme so other themes keep their blur.
             */
            [data-theme='glass-effect'] .chrome-button,
            [data-theme='glass-effect'] .chrome-panel,
            [data-theme='glass-effect'] .settings-panel,
            [data-theme='glass-effect'] .search-shell,
            [data-theme='glass-effect'] .search-popover,
            [data-theme='glass-effect'] .backdrop-blur-md,
            [data-theme='glass-effect'] .-right-2.-top-2 {
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }

            /*
             * Users who ask for reduced transparency get an opaque, unblurred
             * surface instead of glass. This is the purpose-built opt-out
             * (Chrome 118+, Media Queries 5) and it is also the cheapest state
             * we can render: no backdrop-filter means no per-frame backdrop
             * snapshot and no re-filter whenever content behind the panel is
             * damaged. The tint is raised so the panel still reads as a panel.
             */
            @media (prefers-reduced-transparency: reduce) {
              [data-theme='glass-effect'] .slg-glass {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                background: rgba(22, 28, 42, 0.94) !important;
              }
              [data-theme='glass-effect'] .slg-shine {
                display: none !important;
              }
            }
          `,
        }),
      )
    },
  },
  defineWidgetPlugin(tunerWidget),
]
