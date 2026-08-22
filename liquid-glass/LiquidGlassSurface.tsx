import type { HTMLAttributes } from 'react'
import { LiquidGlass } from 'simple-liquid-glass'

export function LiquidGlassSurface({ children, className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
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
      <LiquidGlass
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ position: 'absolute', inset: 0, zIndex: -1 }}
        mode="custom"
        scale={18}
        radius={24}
        border={0.06}
        lightness={52}
        alpha={0.7}
        displace={1.5}
        blur={8}
        dispersion={8}
        saturation={125}
        frost={0.32}
        lens="rim"
        lensStrength={0.4}
        borderColor="rgba(255, 255, 255, 0.34)"
        glassColor="rgba(40, 48, 64, 0.42)"
      />
      {children}
    </div>
  )
}
