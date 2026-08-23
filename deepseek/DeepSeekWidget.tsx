import { Gauge, RefreshCw, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WidgetCard } from '@host/components/WidgetCard'
import { useStoredState } from '@host/hooks/useLocalStorage'
import { isInPeakWindows, parsePeakWindows, PEAK_WINDOWS_JSON } from '../_shared/peakWindows'
import type { WidgetProps } from '@host/plugins/types'
import { useWidgetSettings } from '@host/plugins/widgetSettings'

const API_URL = 'https://api.deepseek.com/user/balance'

/** Placeholder payload used in the Add-Widget preview (no live fetch, no key). */
const PREVIEW_DATA = {
  is_available: true,
  balance_infos: [
    {
      currency: 'CNY',
      total_balance: '88.00',
      granted_balance: '10.00',
      topped_up_balance: '78.00',
    },
  ],
}

interface CacheData {
  json: unknown
  fetchedAt: number
}

function getBalanceInfo(json: unknown): Record<string, unknown> | null {
  if (typeof json !== 'object' || json === null) return null
  const infos = (json as Record<string, unknown>).balance_infos
  if (!Array.isArray(infos) || infos.length === 0) return null
  const first = infos[0]
  return typeof first === 'object' && first !== null ? (first as Record<string, unknown>) : null
}

function formatCny(value: unknown): string {
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return '—'
  const text = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
  return `${text} CNY`
}

function isLow(value: unknown): boolean {
  const num = typeof value === 'number' ? value : Number(value)
  return !Number.isNaN(num) && num < 10
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

export function DeepSeekWidget({ widgetKey, preview, compact }: WidgetProps) {
  const isPreview = preview === true
  const resolvedKey = widgetKey ?? 'deepseek'
  const { settings } = useWidgetSettings(resolvedKey)
  const apiKey = String(settings.apiKey ?? '')
  const title = String(settings.title ?? 'DeepSeek')
  const refreshMinutes = Number(settings.refreshMinutes ?? 30)
  const peakReminder = Boolean(settings.peakReminder)

  // Peak-window reminder: re-evaluate the local time every 30s so the card
  // flips right at the window boundaries.
  const peakWindows = useMemo(
    () => (peakReminder ? parsePeakWindows(PEAK_WINDOWS_JSON) : []),
    [peakReminder],
  )
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (isPreview) return
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [isPreview])
  const inPeak = useMemo(() => isInPeakWindows(peakWindows, now), [peakWindows, now])

  const [cache, setCache, cacheHydrated] = useStoredState<CacheData | null>(
    `deepseek-cache:${resolvedKey}`,
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)
  const didInitialFetchRef = useRef(false)
  const lastApiKeyRef = useRef<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!apiKey) {
      setError('请在 设置 → Widgets → DeepSeek Balance 中填入 API Key')
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
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
      setCache({ json, fetchedAt: Date.now() })
    } catch (err) {
      if (seq !== seqRef.current) return
      setError(err instanceof Error ? err.message : String(err))
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
    () => (isPreview ? { json: PREVIEW_DATA, fetchedAt: Date.now() } : cache),
    [isPreview, cache],
  )

  const info = useMemo(() => (displayCache ? getBalanceInfo(displayCache.json) : null), [displayCache])

  const rows = useMemo(() => {
    if (!info) return []
    return [
      { label: '总余额', value: info.total_balance, low: isLow(info.total_balance) },
      { label: '赠送额度', value: info.granted_balance, low: false },
      { label: '充值额度', value: info.topped_up_balance, low: false },
    ]
  }, [info])

  return (
    <WidgetCard
      className={[
        'flex h-full flex-col',
        compact ? 'gap-2 p-2.5' : 'gap-3 p-4',
        inPeak ? '!border-amber-300/70 !shadow-[0_0_26px_-8px_rgba(251,191,36,0.55)]' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
          <Gauge className="h-3 w-3 shrink-0 text-sky-200/70" />
          <span className="truncate">{title}</span>
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

      <div className="flex min-h-0 flex-1 flex-col justify-center">
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

        {!error && !displayCache && loading && <div className="text-center text-xs text-white/35">加载中…</div>}
        {!error && !displayCache && !loading && (
          <div className="text-center text-xs text-white/35">点击右上角刷新获取数据</div>
        )}

        {!error && displayCache && info && (
          <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-2'}`}>
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-xs text-white/55">{row.label}</span>
                <span
                  className={`shrink-0 font-mono ${compact ? 'text-xs' : 'text-sm'} ${
                    row.low ? 'text-rose-300' : 'text-white'
                  }`}
                >
                  {formatCny(row.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!error && displayCache && !info && (
          <div className="text-xs text-white/35">未找到 balance_infos 数据</div>
        )}
      </div>
    </WidgetCard>
  )
}
