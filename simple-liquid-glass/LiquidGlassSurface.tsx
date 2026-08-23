import { useId } from 'react'
import type { HTMLAttributes } from 'react'
import { LiquidGlass } from 'simple-liquid-glass'
import { useWidgetSettings } from '@host/plugins/widgetSettings'
import { glassParams, TUNER_WIDGET_ID } from './tuner'

export function LiquidGlassSurface({ children, className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const filterId = useId()
  const { settings } = useWidgetSettings(TUNER_WIDGET_ID)
  const params = glassParams(settings)

  // simple-liquid-glass refractions via `feImage href="data:..."`, which
  // Chromium blocks inside SVG filters — so its displacement map never loads
  // and there is no actual bending. Chromium does honour
  // `backdrop-filter: url(#filter)` when the filter is procedural
  // (feTurbulence) — verified live. So we inject our own feTurbulence +
  // feDisplacementMap filter (R/G/B offsets = chromatic aberration) and
  // reference it from our own overlay element's backdrop-filter.
  const rScale = params.displacementScale
  const gScale = params.displacementScale * Math.max(0, 1 - params.aberrationIntensity * 0.05)
  const bScale = params.displacementScale * Math.max(0, 1 - params.aberrationIntensity * 0.1)
  const frostColor = `hsl(0 0% 100% / ${params.frost})`
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
      {/* Library visuals: edge highlights + border + frost field. Its own
          backdrop-filter (a dead feImage url) is neutralized in CSS; we take
          over refraction below. */}
      <div aria-hidden="true" className="slg-base" style={{ position: 'absolute', inset: 0, zIndex: -2 }}>
        <LiquidGlass
          mode="custom"
          scale={18}
          radius={params.radius}
          border={0.06}
          lightness={52}
          alpha={0.7}
          displace={2}
          blur={0}
          dispersion={0}
          saturation={100}
          frost={params.frost}
          lens={params.lens}
          lensStrength={0.4}
          borderColor="rgba(255, 255, 255, 0.34)"
          glassColor="rgba(40, 48, 64, 0.42)"
          style={{ position: 'absolute', inset: 0 }}
        />
      </div>

      {/* Our refraction overlay. Own element so library re-renders never wipe it. */}
      <div
        aria-hidden="true"
        className="slg-glass"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          borderRadius: params.radius,
          background: frostColor,
          backdropFilter: backgroundEffect,
          WebkitBackdropFilter: backgroundEffect,
          boxShadow:
            'inset 0 1px 1px rgba(255, 255, 255, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.16)',
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
