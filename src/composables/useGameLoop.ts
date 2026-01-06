import { ref, onUnmounted } from 'vue'
import { createTimeSource, type TimeSource, type TimeSourceConfig } from '@/services/timeSource'

export type TickFn = (now: number, deltaMs: number) => void

/**
 * 追赶模式回调
 * @param pendingMs 待追赶的时间（毫秒）
 * @param totalCaughtUp 本次追赶的总时间
 */
export type CatchUpFn = (pendingMs: number, totalCaughtUp: number) => void

/**
 * 游戏循环配置
 */
export interface GameLoopOptions {
  /** tick 间隔（毫秒，默认 1000） */
  intervalMs?: number
  /** 时间源配置 */
  timeSourceConfig?: Partial<TimeSourceConfig>
  /** 追赶模式回调 */
  onCatchUp?: CatchUpFn
}

/**
 * 游戏循环 composable
 * 提供可测试、可暂停的定时器管理
 * 集成 TimeSource 处理离线/标签页不活跃场景
 */
export const useGameLoop = (tick: TickFn, optionsOrInterval: GameLoopOptions | number = 1000) => {
  // 兼容旧版 API（直接传入 intervalMs）
  const options: GameLoopOptions = typeof optionsOrInterval === 'number' ? { intervalMs: optionsOrInterval } : optionsOrInterval

  const intervalMs = options.intervalMs ?? 1000

  const timerId = ref<ReturnType<typeof setInterval> | null>(null)
  const catchUpTimerId = ref<ReturnType<typeof setInterval> | null>(null)
  const timeSource: TimeSource = createTimeSource(options.timeSourceConfig)

  // 追赶模式状态
  const isCatchingUp = ref(false)
  const totalCaughtUp = ref(0)

  const isRunning = () => timerId.value !== null

  /**
   * 处理追赶模式
   * 在追赶模式下，会以更快的频率处理积压的时间
   */
  const processCatchUp = () => {
    const pending = timeSource.getPendingCatchUp()
    if (pending <= 0) {
      // 追赶完成
      if (catchUpTimerId.value) {
        clearInterval(catchUpTimerId.value)
        catchUpTimerId.value = null
      }
      isCatchingUp.value = false
      totalCaughtUp.value = 0
      return
    }

    // 获取追赶配置
    const chunkSize = options.timeSourceConfig?.catchUpChunkSize ?? 60000 // 默认 60 秒
    const catchUpAmount = Math.min(pending, chunkSize)

    // 消耗追赶时间
    timeSource.consumeCatchUp(catchUpAmount)
    totalCaughtUp.value += catchUpAmount

    // 执行追赶 tick（使用当前时间，但 deltaMs 是追赶时间）
    const now = timeSource.now()
    tick(now, catchUpAmount)

    // 通知追赶进度
    options.onCatchUp?.(timeSource.getPendingCatchUp(), totalCaughtUp.value)
  }

  /**
   * 启动追赶模式
   */
  const startCatchUp = () => {
    if (catchUpTimerId.value) return
    isCatchingUp.value = true
    totalCaughtUp.value = 0

    // 追赶模式使用更快的间隔（100ms）
    catchUpTimerId.value = setInterval(processCatchUp, 100)
  }

  /**
   * 主循环 tick
   */
  const mainTick = () => {
    const now = timeSource.now()
    const deltaMs = timeSource.getDeltaMs(now)

    // 执行正常 tick
    tick(now, deltaMs)

    // 检查是否需要追赶
    if (timeSource.needsCatchUp(now) && !isCatchingUp.value) {
      startCatchUp()
    }
  }

  const start = () => {
    if (timerId.value) {
      clearInterval(timerId.value)
    }

    // 初始化时间源
    timeSource.setLastTime(timeSource.now())
    timeSource.resetCatchUp()

    // 启动主循环
    timerId.value = setInterval(mainTick, intervalMs)
  }

  const stop = () => {
    // 停止主循环
    if (timerId.value) {
      clearInterval(timerId.value)
      timerId.value = null
    }
    // 停止追赶循环
    if (catchUpTimerId.value) {
      clearInterval(catchUpTimerId.value)
      catchUpTimerId.value = null
    }
    isCatchingUp.value = false
  }

  /**
   * 获取时间源（用于调试或高级用途）
   */
  const getTimeSource = () => timeSource

  /**
   * 检查是否正在追赶
   */
  const getIsCatchingUp = () => isCatchingUp.value

  /**
   * 获取待追赶时间
   */
  const getPendingCatchUp = () => timeSource.getPendingCatchUp()

  // 组件卸载时自动清理
  onUnmounted(() => {
    stop()
  })

  return {
    start,
    stop,
    isRunning,
    getTimeSource,
    getIsCatchingUp,
    getPendingCatchUp
  }
}
