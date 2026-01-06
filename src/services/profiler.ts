/**
 * 性能分析器
 * 用于追踪每个 tick 中各子系统的耗时
 */

/**
 * 性能分析器接口
 */
export interface Profiler {
  /** 开始计时 */
  start(label: string): void
  /** 结束计时 */
  end(label: string): void
  /** 获取当前快照（各标签耗时，单位 ms） */
  snapshot(): Record<string, number>
  /** 重置所有计时数据 */
  reset(): void
  /** 获取平均耗时（最近 N 次） */
  averages(): Record<string, number>
  /** 是否启用 */
  enabled: boolean
}

/**
 * 性能分析器选项
 */
export interface ProfilerOptions {
  /** 是否启用（默认仅在开发环境启用） */
  enabled?: boolean
  /** 保留的历史记录数量（用于计算平均值） */
  historySize?: number
  /** 是否在控制台输出警告（耗时超过阈值时） */
  warnThreshold?: number
}

/**
 * 创建性能分析器
 */
export const createProfiler = (options: ProfilerOptions = {}): Profiler => {
  const {
    enabled = import.meta.env.DEV,
    historySize = 60,
    warnThreshold = 16 // 超过 16ms（60fps 帧时间）时警告
  } = options

  // 当前 tick 的计时数据
  const currentTimings: Map<string, number> = new Map()
  // 开始时间戳
  const startTimes: Map<string, number> = new Map()
  // 历史记录（用于计算平均值）
  const history: Map<string, number[]> = new Map()

  let isEnabled = enabled

  const start = (label: string): void => {
    if (!isEnabled) return
    startTimes.set(label, performance.now())
  }

  const end = (label: string): void => {
    if (!isEnabled) return

    const startTime = startTimes.get(label)
    if (startTime === undefined) {
      console.warn(`[Profiler] end() called without matching start() for label: ${label}`)
      return
    }

    const duration = performance.now() - startTime
    currentTimings.set(label, duration)
    startTimes.delete(label)

    // 添加到历史记录
    let labelHistory = history.get(label)
    if (!labelHistory) {
      labelHistory = []
      history.set(label, labelHistory)
    }
    labelHistory.push(duration)
    if (labelHistory.length > historySize) {
      labelHistory.shift()
    }

    // 超过阈值时警告
    if (warnThreshold > 0 && duration > warnThreshold) {
      console.warn(`[Profiler] ${label} took ${duration.toFixed(2)}ms (threshold: ${warnThreshold}ms)`)
    }
  }

  const snapshot = (): Record<string, number> => {
    const result: Record<string, number> = {}
    for (const [label, duration] of currentTimings) {
      result[label] = Math.round(duration * 100) / 100 // 保留2位小数
    }
    return result
  }

  const reset = (): void => {
    currentTimings.clear()
    startTimes.clear()
  }

  const averages = (): Record<string, number> => {
    const result: Record<string, number> = {}
    for (const [label, durations] of history) {
      if (durations.length > 0) {
        const sum = durations.reduce((a, b) => a + b, 0)
        result[label] = Math.round((sum / durations.length) * 100) / 100
      }
    }
    return result
  }

  return {
    start,
    end,
    snapshot,
    reset,
    averages,
    get enabled() {
      return isEnabled
    },
    set enabled(value: boolean) {
      isEnabled = value
      if (!value) {
        currentTimings.clear()
        startTimes.clear()
        history.clear()
      }
    }
  }
}

/**
 * 全局性能分析器单例
 */
export const profiler = createProfiler()

/**
 * 便捷装饰器：测量函数执行时间
 */
export const measure = <T extends (...args: unknown[]) => unknown>(label: string, fn: T): T => {
  return ((...args: unknown[]) => {
    profiler.start(label)
    try {
      const result = fn(...args)
      // 处理 Promise
      if (result instanceof Promise) {
        return result.finally(() => profiler.end(label))
      }
      profiler.end(label)
      return result
    } catch (error) {
      profiler.end(label)
      throw error
    }
  }) as T
}
