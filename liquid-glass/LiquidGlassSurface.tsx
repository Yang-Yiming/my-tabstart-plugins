import { useId } from 'react'
import type { HTMLAttributes } from 'react'
import LiquidGlass from 'liquid-glass-react'
import { useWidgetSettings } from '@host/plugins/widgetSettings'
import { glassParams, TUNER_WIDGET_ID } from './tuner'

const TINT = 'rgba(18, 24, 42, 0.30)'

export function LiquidGlassSurface({ children, className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const filterId = useId()
  const { settings } = useWidgetSettings(TUNER_WIDGET_ID)
  const params = glassParams(settings)

  // liquid-glass-react's (and simple-liquid-glass's) refraction relies on
  // feImage href="data:..." displacement maps, which Chromium blocks inside SVG
  // filters — so the map never loads and neither produces any actual bending.
  // Chromium *does* honour backdrop-filter: url(#filter) when the filter is
  // procedural (feTurbulence) — verified live. So we inject our own
  // feTurbulence + feDisplacementMap filter (R/G/B offsets = chromatic
  // aberration) and reference it from our own overlay element's backdrop-filter.
  const rScale = params.displacementScale
  const gScale = params.displacementScale * Math.max(0, 1 - params.aberrationIntensity * 0.05)
  const bScale = params.displacementScale * Math.max(0, 1 - params.aberrationIntensity * 0.1)
  const blurPx = (4 + params.blurAmount * 32).toFixed(1)
  const backgroundEffect = `blur(${blurPx}px) saturate(${Math.round(params.saturation)}%) url(#${filterId})`

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
      {/* Library structure: rim highlights + drop shadow + (dead) filter defs. */}
      <div aria-hidden="true" className="lgx-backdrop" style={{ position: 'absolute', inset: 0, zIndex: -1 }}>
        <LiquidGlass
          mode="standard"
          displacementScale={0}
          blurAmount={0}
          saturation={100}
          aberrationIntensity={0}
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

      {/* Our refraction overlay. Own element (not /glass) so React re-renders of
          the library never wipe the inline backdrop-filter. */}
      <div
        aria-hidden="true"
        className="lgx-glass"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          borderRadius: params.cornerRadius,
          background: TINT,
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
