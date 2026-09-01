import { lgrMapUrl, type LgrMode } from './maps'

/**
 * Vendored from liquid-glass-react (https://github.com/rdev/liquid-glass-react),
 * the `GlassFilter` component in `src/index.tsx`, MIT License © rdev.
 * Keep in sync with upstream when upgrading.
 *
 * Adaptations vs upstream (node graph, scales — otherwise faithful):
 *   1. <feImage> receives a blob: URL from lgrMapUrl() instead of the raw
 *      data: URI (data: silently fails inside backdrop-filter here).
 *   2. The hosting <svg> is styled as a full-size non-interactive overlay
 *      instead of an absolutely-positioned sized box.
 *   3. **The edge-mask / clean-center chain is DELETED** (perf, see below).
 *      Upstream: feColorMatrix → feComponentTransfer(EDGE_MASK) → feOffset →
 *      feComponentTransfer(INVERTED_MASK) → 2× feComposite. Algebraically this
 *      chain is the identity function on Chromium: its feColorMatrix keeps the
 *      alpha channel (`0 0 0 1 0` row) and all three upstream maps are opaque
 *      (JPEG / RGB-PNG → alpha = 1 everywhere), so EDGE_MASK is constant alpha
 *      1, INVERTED_MASK constant alpha 0, CENTER_CLEAN empty, and the final
 *      `over` passes ABERRATED_BLURRED through bitwise unchanged. Retaining it
 *      would burn 7 full-region passes per filter evaluation at a 170% region
 *      — the main reason `lgr` janked while `lens` (same 9-10 primitives) was
 *      smooth. Output pixels are identical with the chain removed.
 *   4. The `<radialGradient id={id}-edge-mask>` def is dropped (upstream dead
 *      markup — never referenced by the graph).
 */

interface LgrGlassFilterProps {
  id: string
  displacementScale: number
  aberrationIntensity: number
  mode: LgrMode
}

export function LgrGlassFilter({ id, displacementScale, aberrationIntensity, mode }: LgrGlassFilterProps) {
  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <defs>
        <filter id={id} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
          <feImage
            id="feimage"
            x="0"
            y="0"
            width="100%"
            height="100%"
            result="DISPLACEMENT_MAP"
            href={lgrMapUrl(mode)}
            preserveAspectRatio="xMidYMid slice"
          />

          {/* Red channel displacement with slight offset */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={displacementScale * -1}
            xChannelSelector="R"
            yChannelSelector="B"
            result="RED_DISPLACED"
          />
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                   0 0 0 0 0
                   0 0 0 0 0
                   0 0 0 1 0"
            result="RED_CHANNEL"
          />

          {/* Green channel displacement */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={displacementScale * (-1 - aberrationIntensity * 0.05)}
            xChannelSelector="R"
            yChannelSelector="B"
            result="GREEN_DISPLACED"
          />
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                   0 1 0 0 0
                   0 0 0 0 0
                   0 0 0 1 0"
            result="GREEN_CHANNEL"
          />

          {/* Blue channel displacement with slight offset */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={displacementScale * (-1 - aberrationIntensity * 0.1)}
            xChannelSelector="R"
            yChannelSelector="B"
            result="BLUE_DISPLACED"
          />
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                   0 0 0 0 0
                   0 0 1 0 0
                   0 0 0 1 0"
            result="BLUE_CHANNEL"
          />

          {/* Combine all channels with screen blend mode for chromatic aberration */}
          <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
          <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />

          {/* Add slight blur to soften the aberration effect (filter output) */}
          <feGaussianBlur in="RGB_COMBINED" stdDeviation={Math.max(0.1, 0.5 - aberrationIntensity * 0.1)} />
        </filter>
      </defs>
    </svg>
  )
}
