import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'
import { useWidgetSettings } from '@host/plugins/widgetSettings'
import { glassParams, TUNER_WIDGET_ID } from './tuner'
import { quantizedSize } from './slg/displacementMap'
import { displacementMapUrl } from './slg/mapUrl'
import { LgrGlassFilter } from './lgr/LgrGlassFilter'

/**
 * Fully self-contained liquid glass surface. No third-party dependency.
 *
 * Three refraction engines (switchable in Settings → Widgets → Glass Effect):
 *   - `lens`  — parametric displacement map vendored from simple-liquid-glass,
 *               rendered to an SVG string at runtime and fed to <feImage> as a
 *               blob: URL (data: URLs are unreliable here; blob: is verified).
 *               Real edge refraction: clear center, bending rim. Chromium only.
 *   - `lgr`   — the three static pre-encoded maps vendored from liquid-glass-
 *               react, decoded to blob: URLs and run through that library's
 *               verbatim filter graph (negative scales, edge mask, clean
 *               center). Chromium only.
 *   - `noise` — procedural feTurbulence field (original engine), also the
 *               fallback whenever a map engine isn't ready yet.
 *
 * Layers (bottom → top), all pinned under the content with negative z-index:
 *   1. refraction overlay  — backdrop-filter = blur + saturate + url(#filter)
 *      with per-channel feDisplacementMap offsets (chromatic aberration),
 *      frost tint, inset highlight, drop shadow
 *   2. glass border        — 1px gradient rim via the padding-box mask trick
 *   3. top shine           — soft diagonal highlight
 */

// Map internal resolution: upstream simple-liquid-glass "high" quality tier.
const MAP_DIVISOR = 2.5
const MAP_QUANT_STEP = 16

// Neutral-band constants baked into the map's rim (upstream preset values):
// a near-neutral gray band that clamps the outermost rim back to zero
// displacement so the field never tears at the boundary.
const MAP_BORDER = 0.06
const MAP_LIGHTNESS = 53
const MAP_ALPHA = 0.9
const MAP_BAND_BLUR = 4

function useElementSize() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

export function LiquidGlassSurface({ children, className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const filterId = useId()
  const { settings } = useWidgetSettings(TUNER_WIDGET_ID)
  const params = glassParams(settings)
  const [rootRef, size] = useElementSize()

  // Build the lens map for the measured (quantized) element size. Null until
  // first layout measurement or when the noise engine is selected; the filter
  // then falls back to feTurbulence.
  const mapUrl = useMemo(() => {
    if (params.engine !== 'lens' || size.width < 8 || size.height < 8) return null
    const { newwidth, newheight } = quantizedSize(size.width, size.height, MAP_DIVISOR, MAP_QUANT_STEP)
    // Quantize the scale contribution like upstream so live slider drags don't
    // spawn a blob URL per pixel value (the band geometry depends on it).
    const qScale = Math.round(params.displacementScale / 8) * 8
    return displacementMapUrl(
      `w:${newwidth}|h:${newheight}|r:${params.radius}|lm:${params.lensMode}|ls:${params.lensStrength}|ds:${qScale}`,
      {
        width: size.width,
        height: size.height,
        divisor: MAP_DIVISOR,
        quantStep: MAP_QUANT_STEP,
        radius: params.radius,
        border: MAP_BORDER,
        lightness: MAP_LIGHTNESS,
        alpha: MAP_ALPHA,
        displace: MAP_BAND_BLUR,
        blend: 'difference',
        shapeAdapt: true,
        lens: params.lensMode,
        lensStrength: params.lensStrength,
        scale: params.displacementScale,
      },
    )
  }, [
    params.engine,
    params.lensMode,
    params.lensStrength,
    params.radius,
    params.displacementScale,
    size.width,
    size.height,
  ])

  const useLensMap = params.engine === 'lens' && mapUrl !== null

  const rScale = params.displacementScale
  const gScale = params.displacementScale * Math.max(0, 1 - params.aberrationIntensity * 0.05)
  const bScale = params.displacementScale * Math.max(0, 1 - params.aberrationIntensity * 0.1)
  const backgroundEffect = `blur(${params.blur}px) saturate(${Math.round(params.saturation)}%) url(#${filterId})`
  return (
    <div
      {...props}
      ref={rootRef}
      className={className}
      style={{
        isolation: 'isolate',
        background: 'transparent',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        ...style,
      }}
    >
      {/* Refraction + frost overlay */}
      <div
        aria-hidden="true"
        className="slg-glass"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          borderRadius: params.radius,
          // dark glass base (was glassColor) under the frost tint (was `frost`)
          background: `linear-gradient(hsl(0 0% 100% / ${params.frost}), hsl(0 0% 100% / ${params.frost})), linear-gradient(rgba(40, 48, 64, 0.42), rgba(40, 48, 64, 0.42))`,
          backdropFilter: backgroundEffect,
          WebkitBackdropFilter: backgroundEffect,
          boxShadow:
            'inset 0 1px 1px rgba(255, 255, 255, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 12px 40px rgba(0, 0, 0, 0.25)',
        }}
      />

      {/* 1px gradient rim (padding-box mask keeps the interior transparent) */}
      <div
        aria-hidden="true"
        className="slg-border"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          borderRadius: params.radius,
          border: '1px solid transparent',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.34), rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, rgba(255,255,255,0.34)) border-box',
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          mask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          pointerEvents: 'none',
        }}
      />

      {/* Soft top shine */}
      <div
        aria-hidden="true"
        className="slg-shine"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          borderRadius: params.radius,
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0) 58%)',
          pointerEvents: 'none',
        }}
      />

      {/* Filter defs. Rendered at the element's real size (not 0×0): Chromium is
          suspected to skip external-resource loads (feImage) inside non-rendered
          SVG containers — this mirrors how simple-liquid-glass hosts its defs.
          A defs-only SVG paints nothing. */}
      {params.engine === 'lgr' ? (
        <LgrGlassFilter
          id={filterId}
          displacementScale={params.displacementScale}
          aberrationIntensity={params.aberrationIntensity}
          mode={params.lgrMode}
        />
      ) : (
        <svg
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <defs>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
              {useLensMap ? (
                // The SLG classic/convex/rim maps encode X in red and Y in blue.
                <feImage href={mapUrl ?? undefined} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
              ) : (
                <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves={1} seed={11} result="map" />
              )}
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={rScale}
                xChannelSelector="R"
                yChannelSelector={useLensMap ? 'B' : 'G'}
                result="dR"
              />
              <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="R" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={gScale}
                xChannelSelector="R"
                yChannelSelector={useLensMap ? 'B' : 'G'}
                result="dG"
              />
              <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="G" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={bScale}
                xChannelSelector="R"
                yChannelSelector={useLensMap ? 'B' : 'G'}
                result="dB"
              />
              <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="B" />
              <feBlend in="R" in2="G" mode="screen" result="RG" />
              <feBlend in="RG" in2="B" mode="screen" result="OUT" />
            </filter>
          </defs>
        </svg>
      )}

      {children}
    </div>
  )
}
