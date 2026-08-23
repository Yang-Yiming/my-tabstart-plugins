import { useId } from 'react'
import type { HTMLAttributes } from 'react'
import { useWidgetSettings } from '@host/plugins/widgetSettings'
import { glassParams, TUNER_WIDGET_ID } from './tuner'

/**
 * Fully self-contained liquid glass surface. No third-party dependency.
 *
 * Layers (bottom → top), all pinned under the content with negative z-index:
 *   1. refraction overlay  — backdrop-filter = blur + saturate + feTurbulence
 *      displacement (R/G/B offsets = chromatic aberration), frost tint, inset
 *      highlight, drop shadow
 *   2. glass border        — 1px gradient rim via the padding-box mask trick
 *   3. top shine           — soft diagonal highlight
 * The SVG filter uses only feTurbulence (procedural), which Chromium honours
 * inside backdrop-filter url() — unlike feImage data: maps used by the
 * liquid-glass libraries.
 */
export function LiquidGlassSurface({ children, className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const filterId = useId()
  const { settings } = useWidgetSettings(TUNER_WIDGET_ID)
  const params = glassParams(settings)

  const rScale = params.displacementScale
  const gScale = params.displacementScale * Math.max(0, 1 - params.aberrationIntensity * 0.05)
  const bScale = params.displacementScale * Math.max(0, 1 - params.aberrationIntensity * 0.1)
  const backgroundEffect = `blur(${params.blur}px) saturate(${Math.round(params.saturation)}%) url(#${filterId})`

  return (
    <div
      {...props}
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

      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="1" seed="11" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={rScale} xChannelSelector="R" yChannelSelector="G" result="dR" />
            <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="R" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={gScale} xChannelSelector="R" yChannelSelector="G" result="dG" />
            <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="G" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={bScale} xChannelSelector="R" yChannelSelector="G" result="dB" />
            <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="B" />
            <feBlend in="R" in2="G" mode="screen" result="RG" />
            <feBlend in="RG" in2="B" mode="screen" result="OUT" />
          </filter>
        </defs>
      </svg>

      {children}
    </div>
  )
}