/**
 * 格式化数字为英文单位（K, M, B）
 * @param num 数字
 * @param decimals 小数位数，默认2
 * @returns 格式化后的字符串
 */
export const formatNumber = (num: number, decimals: number = 2): string => {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(decimals) + 'B'
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(decimals) + 'M'
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(decimals) + 'K'
  }
  return Math.floor(num).toString()
}

/**
 * 获取资源颜色类（根据占用率）
 * @param current 当前数量
 * @param max 最大容量
 * @returns Tailwind CSS 类名
 */
export const getResourceColor = (current: number, max: number): string => {
  const ratio = current / max
  if (ratio >= 1) return 'text-red-600 dark:text-red-400'
  if (ratio >= 0.7) return 'text-yellow-600 dark:text-yellow-400'
  return ''
}

/**
 * 格式化时间（秒转为天时分秒）
 * @param seconds 秒数
 * @returns 格式化后的时间字符串（例如 2d 05:30:15 或 05:30:15）
 */
export const formatTime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (days > 0) {
    return `${days}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * 格式化日期
 * @param timestamp 时间戳
 * @returns 格式化后的日期字符串
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 检查资源是否充足并返回对应的颜色类
 * @param available 当前可用资源数量
 * @param required 所需资源数量
 * @returns Tailwind CSS 类名（资源不足时返回红色）
 */
export const getResourceCostColor = (available: number, required: number): string => {
  if (available < required) {
    return 'text-red-600 dark:text-red-400'
  }
  return ''
}
