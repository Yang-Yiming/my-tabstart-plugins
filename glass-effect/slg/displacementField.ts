/**
 * Vendored from simple-liquid-glass (https://github.com/lucaperullo/simple-liquid-glass),
 * `src/core/displacementField.ts`, MIT License © lucaperullo. Trimmed to the exports
 * consumed by `displacementMap.ts` (the fold-test harness functions are omitted).
 * Keep in sync with upstream when upgrading.
 *
 * Pure math for the fold-free `classic` displacement field — no DOM, no SVG strings.
 * The SVG encodes an injectivity guarantee via a Gaussian-blur envelope rather than
 * this model's `smoothstep`, so this is a conservative slope proxy, not a byte-exact
 * mirror of the raster.
 */

// Peak channel deviation of the classic ramp (R spans 0..1 → ±0.5).
export const CLASSIC_PEAK_AMP = 0.5;
// Fold-safety factor: ties BOTH the band width and the amplitude attenuation to the displacement so
// scaleEff·(field slope) stays < 1 (injective). Calibrated by the upstream fold sweep.
export const BAND_K = 1.5;
export const BAND_MIN = 0.06; // floor: a soft edge even at low scale
export const BAND_MAX = 0.45; // ceiling: keeps the mask inset valid (W ≤ 0.45·minSide)

/** Envelope band width as a fraction of the element's short side. */
export function classicBandFraction(scaleEff: number, minElem: number, edgeFeather?: number): number {
  if (typeof edgeFeather === 'number' && Number.isFinite(edgeFeather)) {
    return Math.max(0, Math.min(BAND_MAX, edgeFeather));
  }
  if (!Number.isFinite(scaleEff) || scaleEff <= 0 || !Number.isFinite(minElem) || minElem <= 0) {
    return BAND_MIN;
  }
  const frac = (BAND_K * CLASSIC_PEAK_AMP * scaleEff) / minElem;
  return Math.max(BAND_MIN, Math.min(BAND_MAX, frac));
}

/**
 * Ramp-amplitude multiplier in (0,1]. When the bounded band can fully accommodate the edge
 * displacement the ramp keeps full strength (1). When scale/aspect would otherwise fold past the band
 * ceiling, the amplitude is attenuated just enough to stay injective — graceful strength loss instead
 * of a tear. (Same `BAND_K` as the band width, so the two stay consistent.)
 */
export function classicAmpScale(scaleEff: number, minElem: number, edgeFeather?: number): number {
  if (!Number.isFinite(scaleEff) || scaleEff <= 0 || !Number.isFinite(minElem) || minElem <= 0) return 1;
  const bandFrac = classicBandFraction(scaleEff, minElem, edgeFeather);
  const Wpx = bandFrac * minElem;
  return Math.max(0, Math.min(1, Wpx / (BAND_K * CLASSIC_PEAK_AMP * scaleEff)));
}
