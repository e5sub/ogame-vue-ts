/**
 * 任务函数类型
 */
export type Job = () => void

/**
 * 调度器内部任务记录
 */
interface ScheduledJob {
  /** 任务执行间隔（毫秒） */
  intervalMs: number
  /** 任务函数 */
  job: Job
  /** 上次执行时间 */
  lastRun: number
}

/**
 * 调度器接口
 * 用于管理低频任务（如成就检查、外交清理、自动保存等）
 */
export interface Scheduler {
  /** 注册一个定时任务 */
  every(ms: number, job: Job): void
  /** 每 tick 调用，检查并执行到期的任务 */
  tick(now: number): void
  /** 清除所有任务 */
  clear(): void
}

/**
 * 创建调度器
 * 用于管理不需要每秒运行的低频任务
 */
export const createScheduler = (): Scheduler => {
  const jobs: ScheduledJob[] = []

  const every = (ms: number, job: Job): void => {
    jobs.push({
      intervalMs: ms,
      job,
      lastRun: 0 // 初始为0，确保首次 tick 时立即执行
    })
  }

  const tick = (now: number): void => {
    jobs.forEach(scheduledJob => {
      const elapsed = now - scheduledJob.lastRun
      if (elapsed >= scheduledJob.intervalMs) {
        scheduledJob.job()
        scheduledJob.lastRun = now
      }
    })
  }

  const clear = (): void => {
    jobs.length = 0
  }

  return {
    every,
    tick,
    clear
  }
}
