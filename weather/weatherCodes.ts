import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react'

export interface WeatherCodeInfo {
  /** 中文短描述，例如 `小雨`。 */
  label: string
  icon: LucideIcon
  /** 该天气是否伴随降水（用于高亮提示）。 */
  precip: boolean
}

const CODES: Record<number, WeatherCodeInfo> = {
  0: { label: '晴', icon: Sun, precip: false },
  1: { label: '基本晴', icon: Sun, precip: false },
  2: { label: '多云', icon: CloudSun, precip: false },
  3: { label: '阴', icon: Cloud, precip: false },
  45: { label: '雾', icon: CloudFog, precip: false },
  48: { label: '冻雾', icon: CloudFog, precip: false },
  51: { label: '小毛毛雨', icon: CloudDrizzle, precip: true },
  53: { label: '毛毛雨', icon: CloudDrizzle, precip: true },
  55: { label: '大毛毛雨', icon: CloudDrizzle, precip: true },
  56: { label: '冻毛毛雨', icon: CloudDrizzle, precip: true },
  57: { label: '强冻毛毛雨', icon: CloudDrizzle, precip: true },
  61: { label: '小雨', icon: CloudRain, precip: true },
  63: { label: '中雨', icon: CloudRain, precip: true },
  65: { label: '大雨', icon: CloudRain, precip: true },
  66: { label: '冻雨', icon: CloudRain, precip: true },
  67: { label: '强冻雨', icon: CloudRain, precip: true },
  71: { label: '小雪', icon: CloudSnow, precip: true },
  73: { label: '中雪', icon: CloudSnow, precip: true },
  75: { label: '大雪', icon: CloudSnow, precip: true },
  77: { label: '雪粒', icon: CloudSnow, precip: true },
  80: { label: '小阵雨', icon: CloudRain, precip: true },
  81: { label: '阵雨', icon: CloudRain, precip: true },
  82: { label: '强阵雨', icon: CloudRain, precip: true },
  85: { label: '小阵雪', icon: CloudSnow, precip: true },
  86: { label: '阵雪', icon: CloudSnow, precip: true },
  95: { label: '雷暴', icon: CloudLightning, precip: true },
  96: { label: '雷暴伴冰雹', icon: CloudLightning, precip: true },
  99: { label: '强雷暴伴冰雹', icon: CloudLightning, precip: true },
}

const FALLBACK: WeatherCodeInfo = { label: '未知', icon: Cloud, precip: false }

/** WMO weather_code → 中文描述 + 图标；夜间晴天/多云换月亮系图标。 */
export function getWeatherInfo(code: number, isDay = true): WeatherCodeInfo {
  const info = CODES[code] ?? FALLBACK
  if (!isDay && code === 0) return { ...info, icon: Moon }
  if (!isDay && code === 2) return { ...info, icon: CloudMoon }
  return info
}
