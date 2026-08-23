import { Activity, RefreshCw, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WidgetCard } from '@host/components/WidgetCard'
import { useStoredState } from '@host/hooks/useLocalStorage'
import { isInPeakWindows, parsePeakWindows, PEAK_WINDOWS_JSON } from '../_shared/peakWindows'
import type { WidgetProps } from '@host/plugins/types'
import { useWidgetSettings } from '@host/plugins/widgetSettings'

/**
 * In `bun run dev` the dashboard runs on http://localhost, where
 * opencode.ai does not send CORS headers. Route through the Vite dev proxy
 * in that case; the built extension talks to the API directly.
 */
const API_URL = import.meta.env.DEV
  ? '/opencode-go-api/zen/go/v1/usage'
  : 'https://opencode.ai/zen/go/v1/usage'

/** Official OpenCode Go plan limits (USD). */
const WINDOW_DEFS = [
  { key: 'rolling', label: '5 小时', limit: 12 },
  { key: 'weekly', label: '本周', limit: 30 },
  { key: 'monthly', label: '本月', limit: 60 },
] as const

type WindowKey = (typeof WINDOW_DEFS)[number]['key']

interface ParsedWindow {
  percent: number
  resetsAt: number
}

type ParsedUsage = Record<WindowKey, ParsedWindow>

interface CacheData {
  json: unknown
  fetchedAt: number
}

/** Placeholder payload used in the Add-Widget preview (no live fetch, no key). */
function makePreviewPayload(now: number): unknown {
  return {
    usage: {
      rolling: { status: 'ok', percent: 36, resetsAt: new Date(now + 3 * 3_600_000).toISOString() },
      weekly: { status: 'ok', percent: 18, resetsAt: new Date(now + 3 * 86_400_000).toISOString() },
      monthly: { status: 'ok', percent: 7, resetsAt: new Date(now + 18 * 86_400_000).toISOString() },
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseWindow(value: unknown): ParsedWindow | null {
  const record = asRecord(value)
  if (!record || record.status !== 'ok') return null

  const percent = record.percent
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) {
    return null
  }

  const resetsAt = record.resetsAt
  if (typeof resetsAt !== 'string') return null
  const resetTime = Date.parse(resetsAt)
  if (!Number.isFinite(resetTime)) return null

  return { percent, resetsAt: resetTime }
}

/** Strictly parse the official `GET /zen/go/v1/usage` payload. */
function parseUsagePayload(payload: unknown): ParsedUsage | null {
  const root = asRecord(payload)
  const usage = root ? asRecord(root.usage) : null
  if (!usage) return null

  const parsed = {} as ParsedUsage
  for (const def of WINDOW_DEFS) {
    const window = parseWindow(usage[def.key])
    if (!window) return null
    parsed[def.key] = window
  }
  return parsed
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `$${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`
}

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

function resetText(resetsAt: number, now: number): string {
  const diff = resetsAt - now
  if (diff <= 0) return '即将重置'
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return '即将重置'
  if (minutes < 60) return `${minutes} 分钟后重置`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时后重置`
  return `${Math.round(hours / 24)} 天后重置`
}

function toneClasses(percent: number): { bar: string; text: string } {
  if (percent >= 80) return { bar: 'bg-rose-400', text: 'text-rose-300' }
  if (percent >= 50) return { bar: 'bg-amber-300', text: 'text-amber-300' }
  return { bar: 'bg-emerald-400/90', text: 'text-emerald-300' }
}

export function OpenCodeGoWidget({ widgetKey, preview, compact }: WidgetProps) {
  const isPreview = preview === true
  const resolvedKey = widgetKey ?? 'opencode-go'
  const { settings } = useWidgetSettings(resolvedKey)
  const apiKey = String(settings.apiKey ?? '').trim()
  const title = String(settings.title || 'OpenCode Go')
  const refreshMinutes = Number(settings.refreshMinutes ?? 15)
  const showRolling = Boolean(settings.showRolling)
  const showWeekly = Boolean(settings.showWeekly)
  const showMonthly = Boolean(settings.showMonthly)
  const peakReminder = Boolean(settings.peakReminder)

  // Refresh the reset-countdown labels every 30s.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (isPreview) return
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [isPreview])

  // Peak-window reminder: same local-time surcharge windows as DeepSeek
  // (shared constant), re-evaluated on the same 30s tick so the card flips
  // right at the window boundaries.
  const peakWindows = useMemo(
    () => (peakReminder ? parsePeakWindows(PEAK_WINDOWS_JSON) : []),
    [peakReminder],
  )
  const inPeak = useMemo(() => isInPeakWindows(peakWindows, new Date(now)), [peakWindows, now])

  const [cache, setCache, cacheHydrated] = useStoredState<CacheData | null>(
    `opencode-go-cache:${resolvedKey}`,
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)
  const didInitialFetchRef = useRef(false)
  const lastApiKeyRef = useRef<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!apiKey) {
      setError('请在 设置 → Widgets → OpenCode Go 中填入 API Key')
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (seq !== seqRef.current) return
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        setError(`HTTP ${response.status}${text ? ` · ${text.slice(0, 150)}` : ''}`)
        return
      }
      const json: unknown = await response.json()
      if (seq !== seqRef.current) return
      if (parseUsagePayload(json) === null) {
        setError('返回数据缺少 usage 或格式不符合预期')
        return
      }
      setCache({ json, fetchedAt: Date.now() })
    } catch (err) {
      if (seq !== seqRef.current) return
      const message = err instanceof Error ? err.message : String(err)
      if (message === 'Failed to fetch') {
        setError(
          window.location.protocol === 'chrome-extension:'
            ? '请求失败：请重新构建扩展，并在 chrome://extensions 点击「重新加载」后再试'
            : '请求失败：本地预览请重启 bun run dev 以启用 API 代理',
        )
      } else {
        setError(message)
      }
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [apiKey, setCache])

  // Initial fetch once storage is hydrated (so cached data shows instantly).
  useEffect(() => {
    if (isPreview || !cacheHydrated || didInitialFetchRef.current) return
    didInitialFetchRef.current = true
    fetchData()
  }, [isPreview, cacheHydrated, fetchData])

  // Refetch when the API key changes.
  useEffect(() => {
    if (isPreview || !cacheHydrated) return
    if (lastApiKeyRef.current !== null && lastApiKeyRef.current !== apiKey) {
      fetchData()
    }
    lastApiKeyRef.current = apiKey
  }, [isPreview, apiKey, cacheHydrated, fetchData])

  // Auto refresh interval.
  useEffect(() => {
    if (isPreview || refreshMinutes <= 0) return
    const id = window.setInterval(() => {
      fetchData()
    }, refreshMinutes * 60_000)
    return () => window.clearInterval(id)
  }, [isPreview, refreshMinutes, fetchData])

  // In preview mode show placeholder data instead of the (empty) cache.
  const displayCache = useMemo(
    () => (isPreview ? { json: makePreviewPayload(Date.now()), fetchedAt: Date.now() } : cache),
    [isPreview, cache],
  )

  const usage = useMemo(
    () => (displayCache ? parseUsagePayload(displayCache.json) : null),
    [displayCache],
  )

  const visible = useMemo(
    () =>
      ({
        rolling: showRolling,
        weekly: showWeekly,
        monthly: showMonthly,
      }) as Record<WindowKey, boolean>,
    [showRolling, showWeekly, showMonthly],
  )

  const rows = useMemo(() => {
    if (!usage) return []
    return WINDOW_DEFS.flatMap((def) => {
      if (!visible[def.key]) return []
      const window = usage[def.key]
      const used = window.percent
      const remaining = Math.max(0, 100 - used)
      const spent = (used / 100) * def.limit
      return [
        {
          key: def.key,
          label: def.label,
          limit: def.limit,
          used,
          remaining,
          spent,
          resetLabel: resetText(window.resetsAt, now),
        },
      ]
    })
  }, [usage, visible, now])

  const maxPercent = useMemo(() => rows.reduce((max, row) => Math.max(max, row.used), 0), [rows])
  const danger = maxPercent >= 80
  const displayRows = useMemo(() => {
    if (!compact || rows.length === 0) return rows
    return [rows.reduce((worst, row) => (row.used > worst.used ? row : worst))]
  }, [compact, rows])

  return (
    <WidgetCard
      className={[
        'flex h-full flex-col',
        compact ? 'gap-2 p-2.5' : 'gap-3 p-4',
        danger
          ? '!border-rose-300/70 !shadow-[0_0_26px_-8px_rgba(251,113,133,0.55)]'
          : inPeak
            ? '!border-amber-300/70 !shadow-[0_0_26px_-8px_rgba(251,191,36,0.55)]'
            : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
          <Activity className="h-3 w-3 shrink-0 text-emerald-200/70" />
          <span className="truncate">{title}</span>
          {danger && (
            <span className="shrink-0 rounded-full bg-rose-400/20 px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-wider text-rose-300">
              Limit
            </span>
          )}
          {inPeak && (
            <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-wider text-amber-300">
              Peak
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isPreview && !compact && cache && (
            <span className="text-[10px] text-white/35">{timeAgo(cache.fetchedAt)}</span>
          )}
          <button
            type="button"
            onClick={() => {
              fetchData()
            }}
            disabled={loading}
            className="rounded-full p-1 text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="刷新"
            title="刷新"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
        {error && (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-1.5 text-xs text-rose-300/90">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchData()
              }}
              className="self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              重试
            </button>
          </div>
        )}

        {!error && !displayCache && loading && (
          <div className="text-center text-xs text-white/35">加载中…</div>
        )}
        {!error && !displayCache && !loading && (
          <div className="text-center text-xs text-white/35">点击右上角刷新获取数据</div>
        )}

        {!error && displayCache && !usage && (
          <div className="text-xs text-white/35">未找到 usage 数据</div>
        )}
        {!error && displayCache && usage && rows.length === 0 && (
          <div className="text-xs text-white/35">请在设置中开启至少一个用量窗口</div>
        )}

        {!error && displayCache && usage && rows.length > 0 && (
          <div className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2'}`}>
            {displayRows.map((row) => {
              const tones = toneClasses(row.used)
              return (
                <div key={row.key} className="flex flex-col gap-1">
                  <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <span className="truncate text-[11px] text-white/60">{row.label}</span>
                    <span className="ml-auto flex shrink-0 items-baseline gap-2">
                      {!compact && (
                        <span className="font-mono text-[10px] text-white/35">
                          ~{formatUsd(row.spent)} / ${row.limit}
                        </span>
                      )}
                      <span className={`shrink-0 font-mono text-xs ${tones.text}`}>
                        {formatPercent(row.used)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${tones.bar}`}
                      style={{ width: `${Math.min(100, Math.max(0, row.used))}%` }}
                    />
                  </div>
                  {!compact && (
                    <div className="flex items-center justify-between gap-2 text-[10px] text-white/35">
                      <span>剩余 {formatPercent(row.remaining)}%</span>
                      <span className="truncate">{row.resetLabel}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </WidgetCard>
  )
}
