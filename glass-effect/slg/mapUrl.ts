import { buildDisplacementSvg, type DisplacementParams } from './displacementMap'

/**
 * Module-level cache of displacement-map blob: URLs.
 *
 * We deliberately never revoke these URLs: they are a few KB of SVG each, shared
 * across every glass panel with the same quantized size/params, and revoking one
 * that a live backdrop-filter still references would silently kill the refraction
 * until the next re-render. The key space is bounded by the size quantization in
 * `quantizedSize`, so growth is slow and self-limiting in practice.
 */
const cache = new Map<string, string>()

/**
 * Cache of rasterized displacement-map blob: URLs (SVG key → PNG URL promise).
 *
 * Chromium re-rasterizes feImage-referenced SVG resources on nearly every
 * filter evaluation, and our maps contain internal masks, blurs and blend
 * modes, making that very expensive. A PNG decodes through the cheap image
 * path and hits Chromium's decode cache instead. Conversion is one-time per
 * map key; failures resolve to '' so callers fall back to the SVG/noise path.
 */
const pngCache = new Map<string, Promise<string>>()

async function rasterizeSvgMap(svgUrl: string, width: number, height: number): Promise<string> {
  const img = new Image()
  img.src = svgUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('canvas.toBlob failed')
  return URL.createObjectURL(blob)
}

/**
 * Rasterize the cached SVG map for `key` into a PNG blob: URL. Same size as
 * the SVG viewBox, so feImage stretches it identically. Never revokes (see
 * above); a failed conversion resolves '' once and stays cached.
 */
export function displacementMapPngUrl(key: string, svgUrl: string, width: number, height: number): Promise<string> {
  const hit = pngCache.get(key)
  if (hit) return hit
  const promise = rasterizeSvgMap(svgUrl, width, height).catch(() => '')
  pngCache.set(key, promise)
  return promise
}

/** Build (or fetch from cache) a blob: URL for the displacement map SVG. */
export function displacementMapUrl(key: string, params: DisplacementParams): string {
  const hit = cache.get(key)
  if (hit) return hit
  const svg = buildDisplacementSvg(params)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  cache.set(key, url)
  return url
}
