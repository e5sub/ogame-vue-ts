/**
 * 时间源服务
 * 提供稳定的时间源，处理离线/标签页不活跃场景
 * 防止时间跳跃导致的资源溢出或其他异常
 */

/**
 * 时间源接口
 */
export interface TimeSource {
  /** 获取当前时间戳（毫秒） */
  now(): number
  /** 获取上次记录的时间 */
  getLastTime(): number
  /** 更新上次时间记录 */
  setLastTime(time: number): void
  /** 计算并返回安全的 deltaMs（已限制最大值） */
  getDeltaMs(currentTime: number): number
  /** 检查是否需要追赶（离线时间过长） */
  needsCatchUp(currentTime: number): boolean
  /** 获取待追赶的时间（毫秒） */
  getPendingCatchUp(): number
  /** 消耗一部分追赶时间 */
  consumeCatchUp(amount: number): void
  /** 重置追赶时间 */
  resetCatchUp(): void
}

/**
 * 时间源配置
 */
export interface TimeSourceConfig {
  /** 单次 tick 最大 deltaMs（默认 60 秒） */
  maxDeltaMs: number
  /** 触发追赶模式的阈值（默认 5 分钟） */
  catchUpThreshold: number
  /** 每次追赶的时间量（默认 60 秒） */
  catchUpChunkSize: number
  /** 是否启用追赶模式（默认 true） */
  enableCatchUp: boolean
  /** 最大追赶时间（默认 24 小时，防止离线太久导致资源爆炸） */
  maxCatchUpTime: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TimeSourceConfig = {
  maxDeltaMs: 60 * 1000, // 60 秒
  catchUpThreshold: 5 * 60 * 1000, // 5 分钟
  catchUpChunkSize: 60 * 1000, // 60 秒
  enableCatchUp: true,
  maxCatchUpTime: 24 * 60 * 60 * 1000 // 24 小时
}

/**
 * 创建时间源
 * @param config 可选配置
 */
export const createTimeSource = (config?: Partial<TimeSourceConfig>): TimeSource => {
  const cfg: TimeSourceConfig = { ...DEFAULT_CONFIG, ...config }

  let lastTime = Date.now()
  let pendingCatchUp = 0

  /**
   * 获取当前时间戳
   */
  const now = (): number => {
    return Date.now()
  }

  /**
   * 获取上次记录的时间
   */
  const getLastTime = (): number => {
    return lastTime
  }

  /**
   * 设置上次时间记录
   */
  const setLastTime = (time: number): void => {
    lastTime = time
  }

  /**
   * 计算安全的 deltaMs
   * - 限制最大值防止时间跳跃
   * - 将超出部分存入追赶队列
   */
  const getDeltaMs = (currentTime: number): number => {
    const rawDelta = currentTime - lastTime

    // 负值处理（系统时间被调整）
    if (rawDelta < 0) {
      console.warn('[TimeSource] 检测到负 delta，可能是系统时间被调整')
      lastTime = currentTime
      return 0
    }

    // 如果 delta 超过阈值，启用追赶模式
    if (cfg.enableCatchUp && rawDelta > cfg.catchUpThreshold) {
      // 计算需要追赶的时间（限制最大追赶时间）
      const excessTime = rawDelta - cfg.maxDeltaMs
      pendingCatchUp = Math.min(pendingCatchUp + excessTime, cfg.maxCatchUpTime)

      // 返回限制后的 delta
      lastTime = currentTime
      return cfg.maxDeltaMs
    }

    // 正常情况：限制最大 delta
    const clampedDelta = Math.min(rawDelta, cfg.maxDeltaMs)
    lastTime = currentTime

    return clampedDelta
  }

  /**
   * 检查是否需要追赶
   */
  const needsCatchUp = (currentTime: number): boolean => {
    if (!cfg.enableCatchUp) return false
    return pendingCatchUp > 0 || currentTime - lastTime > cfg.catchUpThreshold
  }

  /**
   * 获取待追赶时间
   */
  const getPendingCatchUp = (): number => {
    return pendingCatchUp
  }

  /**
   * 消耗追赶时间
   */
  const consumeCatchUp = (amount: number): void => {
    pendingCatchUp = Math.max(0, pendingCatchUp - amount)
  }

  /**
   * 重置追赶时间
   */
  const resetCatchUp = (): void => {
    pendingCatchUp = 0
  }

  return {
    now,
    getLastTime,
    setLastTime,
    getDeltaMs,
    needsCatchUp,
    getPendingCatchUp,
    consumeCatchUp,
    resetCatchUp
  }
}

/**
 * 格式化时间差（用于调试/显示）
 */
export const formatTimeDelta = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * 计算离线期间应获得的资源比例
 * 可以根据离线时间长度给予不同的效率
 * @param offlineMs 离线时间（毫秒）
 * @returns 效率系数（0-1）
 */
export const calcOfflineEfficiency = (offlineMs: number): number => {
  // 前 1 小时：100% 效率
  if (offlineMs <= 3600000) return 1.0
  // 1-6 小时：80% 效率
  if (offlineMs <= 6 * 3600000) return 0.8
  // 6-24 小时：50% 效率
  if (offlineMs <= 24 * 3600000) return 0.5
  // 超过 24 小时：30% 效率
  return 0.3
}
