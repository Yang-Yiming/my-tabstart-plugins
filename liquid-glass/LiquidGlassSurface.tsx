import { useEffect, useRef } from 'react'
import { useId } from 'react'
import type { HTMLAttributes } from 'react'
import LiquidGlass from 'liquid-glass-react'
import { useWidgetSettings } from '@host/plugins/widgetSettings'
import { glassParams, TUNER_WIDGET_ID } from './tuner'

// liquid-glass-react's displacement maps are data: URLs, which Chromium blocks
// inside SVG filters (feImage). They DO load from blob: URLs. We read the map
// the library rendered into its own <feImage>, convert it to a blob: URL once
// (cached), and reuse the library's full filter chain with that blob — so the
// library's actual refraction works.
const blobCache = new Map<string, string>()

async function toBlobUrl(dataUrl: string): Promise<string> {
  const cached = blobCache.get(dataUrl)
  if (cached) return cached
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  blobCache.set(dataUrl, url)
  return url
}

export function LiquidGlassSurface({ children, className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const filterId = useId()
  const { settings } = useWidgetSettings(TUNER_WIDGET_ID)
  const params = glassParams(settings)

  // Clone of the library's filter, but with feImage pointing at a blob: URL.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let cancelled = false
    let insertedFilter: SVGFilterElement | null = null

    const apply = async () => {
      const libFilter = root.querySelector<SVGFilterElement>('.lgx-backdrop filter')
      const libFeImage = libFilter?.querySelector<SVGElement>('feImage')
      const dataUrl = libFeImage?.getAttribute('href')
      if (!libFilter || !dataUrl) return

      const blobUrl = await toBlobUrl(dataUrl)
      if (cancelled) return

      // idempotent: remove any previous clone before inserting a fresh one
      insertedFilter?.remove()
      const clone = libFilter.cloneNode(true) as SVGFilterElement
      const id = `${filterId}-disp`
      clone.setAttribute('id', id)
      const cloneFe = clone.querySelector('feImage')
      if (cloneFe) cloneFe.setAttribute('href', blobUrl)
      clone.style.display = 'none'
      root.appendChild(clone)
      insertedFilter = clone

      for (const glass of root.querySelectorAll<HTMLElement>('.lgx-backdrop .glass__warp')) {
        const blurPx = 4 + params.blurAmount * 32
        const value = `blur(${blurPx.toFixed(1)}px) saturate(${Math.round(params.saturation)}%) url(#${id})`
        glass.style.backdropFilter = value
        glass.style.setProperty('-webkit-backdrop-filter', value)
      }
    }

    // Runs on mount and whenever a param changes; no observer loop. The rebinding
    // reads the library's freshly-rendered <filter>/<feImage> each time. A short
    // tick lets the lazy surface mount its defs before we look for them.
    const timeout = setTimeout(() => void apply(), 0)
    return () => {
      cancelled = true
      clearTimeout(timeout)
      insertedFilter?.remove()
      for (const glass of root.querySelectorAll<HTMLElement>('.lgx-backdrop .glass__warp')) {
        glass.style.backdropFilter = ''
        glass.style.setProperty('-webkit-backdrop-filter', '')
      }
    }
  }, [filterId, params.mode, params.blurAmount, params.saturation, params.displacementScale, params.aberrationIntensity, params.cornerRadius])

  return (
    <div
      {...props}
      ref={rootRef}
      className={className}
      style={{
        isolation: 'isolate',
        background: 'rgba(24, 30, 48, 0.32)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        ...style,
      }}
    >
      <div aria-hidden="true" className="lgx-backdrop" style={{ position: 'absolute', inset: 0, zIndex: -1 }}>
        <LiquidGlass
          mode={params.mode}
          displacementScale={params.displacementScale}
          blurAmount={params.blurAmount}
          saturation={params.saturation}
          aberrationIntensity={params.aberrationIntensity}
          elasticity={0}
          cornerRadius={params.cornerRadius}
          padding="0"
          overLight={false}
          className="liquid-glass-react-surface"
          style={{ position: 'absolute', left: '50%', top: '50%', width: '100%', height: '100%' }}
        >
          {null}
        </LiquidGlass>
      </div>
      {children}
    </div>
  )
}
