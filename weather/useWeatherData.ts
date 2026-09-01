import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStoredState } from '@host/hooks/useLocalStorage'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const GEO_TIMEOUT_MS = 5000

export interface WeatherLocation {
  lat: number
  lon: number
  /** 展示用名称，如 `北京` / `我的位置`。 */
  label: string
  /** 缓存 key：坐标做了取整，轻微 GPS 抖动不会让缓存失效。 */
  key: string
  /** 生成该位置时的设置快照，用于判断是否需要重新解析。 */
  cityUsed: string
  useGeoUsed: boolean
}

export interface HourlyPoint {
  /** 如 `14时`。 */
  hour: string
  prob: number
  mm: number
  code: number
}

export interface DailyPoint {
  /** 如 `今天` / `周三`。 */
  label: string
  code: number
  isDay: boolean
  max: number
  min: number
  precipSum: number
  precipProb: number
}

export interface WeatherData {
  location: WeatherLocation
  current: {
    temp: number
    apparent: number
    humidity: number
    wind: number
    precip: number
    code: number
    isDay: boolean
  }
  hourly: HourlyPoint[]
  daily: DailyPoint[]
}

interface WeatherCache {
  locationKey: string
  json: unknown
  fetchedAt: number
}

/* ------------------------------------------------------------------ */
/* 位置解析                                                            */
/* ------------------------------------------------------------------ */

interface GeocodeHit {
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

// 浏览器定位按会话共享一次结果：多个尺寸实例同时挂载时只询问/请求一次。
let geoCoordsPromise: Promise<GeolocationCoordinates | null> | null = null

function getGeoCoords(): Promise<GeolocationCoordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  if (!geoCoordsPromise) {
    geoCoordsPromise = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        () => resolve(null),
        { timeout: GEO_TIMEOUT_MS, maximumAge: 10 * 60_000 },
      )
    })
  }
  return geoCoordsPromise
}

const geocodeCache = new Map<string, Promise<GeocodeHit | null>>()

function geocodeCity(city: string): Promise<GeocodeHit | null> {
  const trimmed = city.trim()
  if (!trimmed) return Promise.resolve(null)
  let hit = geocodeCache.get(trimmed)
  if (!hit) {
    hit = fetch(
      `${GEOCODE_URL}?name=${encodeURIComponent(trimmed)}&count=1&language=zh&format=json`,
      { cache: 'no-store' },
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json: unknown) => {
        const results = (json as { results?: GeocodeHit[] } | null)?.results
        return Array.isArray(results) && results.length > 0 ? results[0] : null
      })
      .catch(() => null)
    geocodeCache.set(trimmed, hit)
  }
  return hit
}

async function resolveLocation(city: string, useGeolocation: boolean): Promise<WeatherLocation | null> {
  if (useGeolocation) {
    const coords = await getGeoCoords()
    if (coords) {
      const lat = Number(coords.latitude.toFixed(2))
      const lon = Number(coords.longitude.toFixed(2))
      return {
        lat,
        lon,
        label: '我的位置',
        key: `geo:${lat},${lon}`,
        cityUsed: city,
        useGeoUsed: true,
      }
    }
  }
  const hit = await geocodeCity(city)
  if (!hit) return null
  return {
    lat: Number(hit.latitude.toFixed(2)),
    lon: Number(hit.longitude.toFixed(2)),
    label: hit.name,
    key: `city:${city.trim()}`,
    cityUsed: city,
    useGeoUsed: useGeolocation,
  }
}

/* ------------------------------------------------------------------ */
/* 预报请求与解析                                                      */
/* ------------------------------------------------------------------ */

// 进行中的请求按坐标去重：多个尺寸实例同时刷新只发一次请求。
const forecastInflight = new Map<string, Promise<unknown>>()

function fetchForecast(lat: number, lon: number): Promise<unknown> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
  let pending = forecastInflight.get(key)
  if (!pending) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,is_day',
      hourly: 'precipitation_probability,precipitation,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '5',
    })
    pending = fetch(`${FORECAST_URL}?${params.toString()}`, { cache: 'no-store' }).then((res) => {
      if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`))
      return res.json()
    })
    forecastInflight.set(key, pending)
    void pending.catch(() => undefined).finally(() => forecastInflight.delete(key))
  }
  return pending
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseWeather(location: WeatherLocation, json: unknown): WeatherData {
  const root = (typeof json === 'object' && json !== null ? json : {}) as Record<string, any>
  const current = (typeof root.current === 'object' && root.current !== null ? root.current : {}) as Record<string, any>
  const hourly = (typeof root.hourly === 'object' && root.hourly !== null ? root.hourly : {}) as Record<string, any>
  const daily = (typeof root.daily === 'object' && root.daily !== null ? root.daily : {}) as Record<string, any>

  // 找到当前小时在 hourly 序列中的下标：直接用 API 返回的本地时间字符串前缀比对，
  // 避免设备时区与目标城市时区不一致的问题。
  const hourlyTimes: string[] = Array.isArray(hourly.time) ? hourly.time : []
  const nowPrefix = String(current.time ?? '').slice(0, 13)
  let idx = hourlyTimes.findIndex((t) => String(t).slice(0, 13) === nowPrefix)
  if (idx < 0) idx = 0

  const hourlyPoints: HourlyPoint[] = hourlyTimes.slice(idx, idx + 8).map((time, offset) => ({
    hour: `${String(time).slice(11, 13)}时`,
    prob: num(hourly.precipitation_probability?.[idx + offset]),
    mm: num(hourly.precipitation?.[idx + offset]),
    code: num(hourly.weather_code?.[idx + offset]),
  }))

  const dailyTimes: string[] = Array.isArray(daily.time) ? daily.time : []
  const today = String(current.time ?? '').slice(0, 10)
  const dailyPoints: DailyPoint[] = dailyTimes.slice(0, 5).map((date, offset) => {
    const isToday = date === today
    let label = isToday ? '今天' : ''
    if (!label) {
      const parsed = new Date(`${date}T12:00:00`)
      label = Number.isNaN(parsed.getTime())
        ? String(date).slice(5)
        : parsed.toLocaleDateString('zh-CN', { weekday: 'short' })
    }
    return {
      label,
      code: num(daily.weather_code?.[offset]),
      isDay: true,
      max: Math.round(num(daily.temperature_2m_max?.[offset])),
      min: Math.round(num(daily.temperature_2m_min?.[offset])),
      precipSum: num(daily.precipitation_sum?.[offset]),
      precipProb: num(daily.precipitation_probability_max?.[offset]),
    }
  })

  return {
    location,
    current: {
      temp: num(current.temperature_2m),
      apparent: num(current.apparent_temperature),
      humidity: Math.round(num(current.relative_humidity_2m)),
      wind: num(current.wind_speed_10m),
      precip: num(current.precipitation),
      code: num(current.weather_code),
      isDay: num(current.is_day, 1) === 1,
    },
    hourly: hourlyPoints,
    daily: dailyPoints,
  }
}

/* ------------------------------------------------------------------ */
/* 预览占位数据（Add-Widget 预览模式，不发请求）                          */
/* ------------------------------------------------------------------ */

export const PREVIEW_DATA: WeatherData = {
  location: { lat: 39.9, lon: 116.4, label: '北京', key: 'preview', cityUsed: '', useGeoUsed: false },
  current: { temp: 26, apparent: 28, humidity: 62, wind: 8.5, precip: 0, code: 2, isDay: true },
  hourly: [
    { hour: '14时', prob: 5, mm: 0, code: 2 },
    { hour: '15时', prob: 10, mm: 0, code: 2 },
    { hour: '16时', prob: 35, mm: 0.2, code: 61 },
    { hour: '17时', prob: 70, mm: 1.4, code: 63 },
    { hour: '18时', prob: 55, mm: 0.6, code: 61 },
    { hour: '19时', prob: 30, mm: 0, code: 3 },
    { hour: '20时', prob: 15, mm: 0, code: 2 },
    { hour: '21时', prob: 5, mm: 0, code: 1 },
  ],
  daily: [
    { label: '今天', code: 2, isDay: true, max: 30, min: 21, precipSum: 2.2, precipProb: 70 },
    { label: '周二', code: 61, isDay: true, max: 28, min: 20, precipSum: 5.8, precipProb: 80 },
    { label: '周三', code: 3, isDay: true, max: 29, min: 19, precipSum: 0, precipProb: 20 },
    { label: '周四', code: 0, isDay: true, max: 32, min: 21, precipSum: 0, precipProb: 5 },
    { label: '周五', code: 95, isDay: true, max: 27, min: 20, precipSum: 9.1, precipProb: 90 },
  ],
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export interface UseWeatherDataResult {
  data: WeatherData | null
  location: WeatherLocation | null
  locating: boolean
  loading: boolean
  error: string | null
  lastFetched: number | null
  refresh: () => void
}

export function useWeatherData(options: {
  city: string
  useGeolocation: boolean
  refreshMinutes: number
  preview?: boolean
}): UseWeatherDataResult {
  const { city, useGeolocation, refreshMinutes, preview } = options

  // 缓存按「位置 key」校验：与当前解析出的位置不符就当作没有缓存。
  // 多个尺寸实例共用同一个 key，先显缓存再请求，且不重复发请求。
  const [cache, setCache] = useStoredState<WeatherCache | null>('weather-cache:v1', null)
  const [location, setLocation] = useState<WeatherLocation | null>(null)
  const [locating, setLocating] = useState(!preview)
  const [liveData, setLiveData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seqRef = useRef(0)

  // 位置解析：挂载或设置变化时重新解析（自动定位被拒/失败会静默回退到城市名）。
  useEffect(() => {
    if (preview) return
    let cancelled = false
    setLocating(true)
    resolveLocation(city, useGeolocation).then((loc) => {
      if (cancelled) return
      setLocating(false)
      setLocation(loc)
      if (!loc) setError(`无法确定位置：定位不可用，且找不到城市「${city.trim() || '(空)'}」`)
    })
    return () => {
      cancelled = true
    }
  }, [city, useGeolocation, preview])

  const loadData = useCallback(
    async (loc: WeatherLocation, silent = false) => {
      const seq = ++seqRef.current
      if (!silent) setLoading(true)
      setError(null)
      try {
        const json = await fetchForecast(loc.lat, loc.lon)
        if (seq !== seqRef.current) return
        setCache({ locationKey: loc.key, json, fetchedAt: Date.now() })
        setLiveData(parseWeather(loc, json))
      } catch (err) {
        if (seq !== seqRef.current) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [setCache],
  )

  // 位置就绪后拉取数据。
  useEffect(() => {
    if (preview || locating || !location) return
    void loadData(location)
  }, [preview, locating, location, loadData])

  // 自动刷新。
  useEffect(() => {
    if (preview || !location || refreshMinutes <= 0) return
    const id = window.setInterval(() => void loadData(location, true), refreshMinutes * 60_000)
    return () => window.clearInterval(id)
  }, [preview, location, refreshMinutes, loadData])

  const cachedData = useMemo(
    () => (cache && location && cache.locationKey === location.key ? parseWeather(location, cache.json) : null),
    [cache, location],
  )

  const data = preview ? PREVIEW_DATA : liveData ?? cachedData

  return {
    data,
    location,
    locating,
    loading,
    error: preview ? null : error,
    lastFetched: preview ? Date.now() : cache?.fetchedAt ?? null,
    refresh: () => {
      if (location) void loadData(location)
    },
  }
}
