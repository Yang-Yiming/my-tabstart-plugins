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

/** Build (or fetch from cache) a blob: URL for the displacement map SVG. */
export function displacementMapUrl(key: string, params: DisplacementParams): string {
  const hit = cache.get(key)
  if (hit) return hit
  const svg = buildDisplacementSvg(params)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  cache.set(key, url)
  return url
}
