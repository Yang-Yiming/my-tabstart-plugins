import { CloudOff, Droplets, MapPin, RefreshCw, TriangleAlert, Umbrella, Wind } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { WidgetCard } from '@host/components/WidgetCard'
import type { WidgetProps } from '@host/plugins/types'
import { useWidgetSettings } from '@host/plugins/widgetSettings'
import { useWeatherData, type HourlyPoint, type UseWeatherDataResult, type WeatherData, type DailyPoint } from './useWeatherData'
import { getWeatherInfo } from './weatherCodes'

type Variant = 'small' | 'medium' | 'large'

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

function useWeatherState(widgetKey: string | undefined, preview: boolean | undefined) {
  const resolvedKey = widgetKey ?? 'weather'
  const { settings } = useWidgetSettings(resolvedKey)
  const city = String(settings.city ?? '北京')
  const useGeolocation = Boolean(settings.useGeolocation ?? true)
  const refreshMinutes = Number(settings.refreshMinutes ?? 30)
  return useWeatherData({ city, useGeolocation, refreshMinutes, preview })
}

/* ------------------------------------------------------------------ */
/* 共享小部件                                                          */
/* ------------------------------------------------------------------ */

function CardHeader({ weather, isPreview }: { weather: UseWeatherDataResult; isPreview: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
        <MapPin className="h-3 w-3 shrink-0 text-sky-200/70" />
        <span className="truncate">{weather.data?.location.label ?? '天气'}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!isPreview && weather.lastFetched && (
          <span className="text-[10px] text-white/35">{timeAgo(weather.lastFetched)}</span>
        )}
        <button
          type="button"
          onClick={weather.refresh}
          disabled={weather.loading || isPreview}
          className="rounded-full p-1 text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          aria-label="刷新"
          title="刷新"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${weather.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  )
}

function PrecipBars({ hourly }: { hourly: HourlyPoint[] }) {
  const hasRain = hourly.some((h) => h.prob > 0 || h.mm > 0)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[10px] text-white/35">
        <Umbrella className="h-3 w-3 shrink-0" />
        <span className="truncate">未来 {hourly.length} 小时降水概率{hasRain ? '' : ' · 暂无降水'}</span>
      </div>
      <div className="flex items-end gap-1.5">
        {hourly.map((h) => (
          <div
            key={h.hour}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
            title={`${h.hour} 降水概率 ${h.prob}%${h.mm > 0 ? ` · ${h.mm}mm` : ''}`}
          >
            <div className="flex h-9 w-full items-end overflow-hidden rounded-[3px] bg-white/10">
              <div
                className={`w-full ${h.mm > 0 ? 'bg-sky-300/80' : h.prob > 0 ? 'bg-sky-300/40' : 'bg-transparent'}`}
                style={{ height: `${Math.max(4, h.prob)}%` }}
              />
            </div>
            <span className="text-[9px] leading-none text-white/35">{h.hour}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricsRow({ data }: { data: WeatherData }) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-white/55">
      <span className="flex items-center gap-1" title="相对湿度">
        <Droplets className="h-3 w-3 shrink-0 text-sky-200/70" />
        湿度 {data.current.humidity}%
      </span>
      <span className="flex items-center gap-1" title="10 米风速">
        <Wind className="h-3 w-3 shrink-0 text-sky-200/70" />
        {data.current.wind} km/h
      </span>
      <span className="flex items-center gap-1" title="当前降水量">
        <Umbrella className="h-3 w-3 shrink-0 text-sky-200/70" />
        降水 {data.current.precip} mm
      </span>
    </div>
  )
}

function CurrentBlock({ data, large }: { data: WeatherData; large?: boolean }) {
  const info = getWeatherInfo(data.current.code, data.current.isDay)
  const Icon: LucideIcon = info.icon
  return (
    <div className="flex items-center gap-3">
      <Icon className={`${large ? 'h-11 w-11' : 'h-10 w-10'} shrink-0 text-amber-200/90`} />
      <div className="flex min-w-0 flex-col">
        <div className="flex items-baseline gap-2">
          <span className={`${large ? 'text-4xl' : 'text-3xl'} font-semibold leading-none text-white`}>
            {Math.round(data.current.temp)}°
          </span>
          <span className="truncate text-xs text-white/55">{info.label}</span>
        </div>
        <span className="text-[11px] text-white/40">体感 {Math.round(data.current.apparent)}°</span>
      </div>
    </div>
  )
}

function DailyList({ daily }: { daily: DailyPoint[] }) {
  return (
    <div className="flex min-w-0 flex-col justify-between">
      {daily.map((d) => {
        const info = getWeatherInfo(d.code)
        const Icon: LucideIcon = info.icon
        return (
          <div key={d.label} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="w-7 shrink-0 text-white/55">{d.label}</span>
            <Icon className={`h-3.5 w-3.5 shrink-0 ${info.precip ? 'text-sky-200/90' : 'text-white/60'}`} />
            <span className="min-w-0 flex-1 truncate text-white/40">{info.label}</span>
            <span className="shrink-0 font-mono text-white/85">
              {d.min}° / {d.max}°
            </span>
            <span
              className={`w-12 shrink-0 text-right font-mono ${d.precipSum > 0 ? 'text-sky-200/90' : 'text-white/25'}`}
              title="当日降水量"
            >
              {d.precipSum > 0 ? `${d.precipSum.toFixed(1)}mm` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 三档布局                                                            */
/* ------------------------------------------------------------------ */

function ErrorBody({ weather, isPreview }: { weather: UseWeatherDataResult; isPreview: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-1.5 text-xs text-rose-300/90">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="break-all">{weather.error}</span>
      </div>
      {!isPreview && (
        <button
          type="button"
          onClick={weather.refresh}
          className="self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          重试
        </button>
      )}
    </div>
  )
}

function PendingBody({ weather }: { weather: UseWeatherDataResult }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-white/35">
      <CloudOff className="h-4 w-4" />
      <span className="text-xs">{weather.locating ? '定位中…' : weather.loading ? '加载中…' : '暂无数据'}</span>
    </div>
  )
}

function SmallBody({ weather }: { weather: UseWeatherDataResult }) {
  const data = weather.data
  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-white/35">
        <CloudOff className="h-4 w-4" />
        <span className="text-[10px]">{weather.locating ? '定位中…' : weather.error ? '获取失败' : '加载中…'}</span>
      </div>
    )
  }
  const info = getWeatherInfo(data.current.code, data.current.isDay)
  const Icon: LucideIcon = info.icon
  return (
    <div className="flex h-full flex-col items-center justify-center gap-0.5">
      <Icon className="h-7 w-7 text-amber-200/90" />
      <span className="text-2xl font-semibold leading-tight text-white">{Math.round(data.current.temp)}°</span>
      <span className="max-w-full truncate text-[11px] text-white/55">{info.label}</span>
      <span className="max-w-full truncate text-[10px] text-white/35">{data.location.label}</span>
    </div>
  )
}

function MediumBody({ weather, isPreview }: { weather: UseWeatherDataResult; isPreview: boolean }) {
  const data = weather.data
  return (
    <>
      <CardHeader weather={weather} isPreview={isPreview} />
      {data ? (
        <>
          <div className="flex min-h-0 flex-1 items-center">
            <CurrentBlock data={data} />
          </div>
          <MetricsRow data={data} />
          <PrecipBars hourly={data.hourly} />
        </>
      ) : weather.error ? (
        <ErrorBody weather={weather} isPreview={isPreview} />
      ) : (
        <PendingBody weather={weather} />
      )}
    </>
  )
}

function LargeBody({ weather, isPreview }: { weather: UseWeatherDataResult; isPreview: boolean }) {
  const data = weather.data
  return (
    <>
      <CardHeader weather={weather} isPreview={isPreview} />
      {data ? (
        <div className="flex min-h-0 flex-1 gap-5">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <CurrentBlock data={data} large />
            <MetricsRow data={data} />
            <PrecipBars hourly={data.hourly} />
          </div>
          <div className="w-px shrink-0 self-stretch bg-white/10" />
          <div className="flex w-56 shrink-0 flex-col">
            <DailyList daily={data.daily} />
          </div>
        </div>
      ) : weather.error ? (
        <ErrorBody weather={weather} isPreview={isPreview} />
      ) : (
        <PendingBody weather={weather} />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 三个尺寸入口                                                        */
/* ------------------------------------------------------------------ */

function WeatherWidgetBase({ variant, widgetKey, preview, compact, className }: WidgetProps & { variant: Variant }) {
  const isPreview = preview === true
  const weather = useWeatherState(widgetKey, isPreview)
  // 被压成单行高度（或本来就是 small）时统一用紧凑布局。
  const layout = useMemo<Variant>(() => (compact === true ? 'small' : variant), [compact, variant])

  return (
    <WidgetCard
      className={[
        'flex h-full flex-col',
        layout === 'small' ? 'gap-1 p-2.5' : 'gap-3 p-4',
        className ?? '',
      ].join(' ')}
    >
      {layout === 'small' ? (
        <SmallBody weather={weather} />
      ) : layout === 'large' ? (
        <LargeBody weather={weather} isPreview={isPreview} />
      ) : (
        <MediumBody weather={weather} isPreview={isPreview} />
      )}
    </WidgetCard>
  )
}

export function WeatherSmallWidget(props: WidgetProps) {
  return <WeatherWidgetBase variant="small" {...props} />
}

export function WeatherWidget(props: WidgetProps) {
  return <WeatherWidgetBase variant="medium" {...props} />
}

export function WeatherLargeWidget(props: WidgetProps) {
  return <WeatherWidgetBase variant="large" {...props} />
}
