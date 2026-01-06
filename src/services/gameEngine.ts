import { useGameStore } from '@/stores/gameStore'
import { useUniverseStore } from '@/stores/universeStore'
import { useNPCStore } from '@/stores/npcStore'
import { createDirtyFlags, type DirtyFlags } from '@/logic/dirtyFlags'
import { createTickContext, type TickContext, type TranslateFn, type NotifyFn, type NotifyUnlockFn } from './tickContext'
import { profiler } from './profiler'

export interface GameEngine {
  /** 初始化引擎（加载/保存钩子等） */
  init(): void
  /** 每帧更新 */
  tick(now: number, deltaMs: number): void
  /** 暂停游戏 */
  pause(): void
  /** 恢复游戏 */
  resume(): void
  /** 清理资源 */
  dispose(): void
  /** 是否已暂停 */
  isPaused(): boolean
}

export interface GameEngineOptions {
  /** 国际化函数 */
  t: TranslateFn
  /** 自定义 tick 处理函数（用于渐进式迁移，接收 TickContext） */
  onTick?: (ctx: TickContext) => void | Promise<void>
  /** 暂停状态变化回调 */
  onPauseChange?: (paused: boolean) => void
  /** 通知回调 */
  notify?: NotifyFn
  /** 解锁通知回调 */
  notifyUnlock?: NotifyUnlockFn
}

/**
 * 创建游戏引擎
 * 作为游戏逻辑的中心协调器，管理所有"每帧发生的事情"
 */
export const createGameEngine = (options: GameEngineOptions): GameEngine => {
  let initialized = false
  let disposed = false

  // 获取 stores（延迟初始化，确保 Pinia 已准备好）
  let gameStore: ReturnType<typeof useGameStore> | null = null
  let universeStore: ReturnType<typeof useUniverseStore> | null = null
  let npcStore: ReturnType<typeof useNPCStore> | null = null

  // 脏标志（性能优化）
  let dirtyFlags: DirtyFlags | null = null

  const getStores = () => {
    if (!gameStore) gameStore = useGameStore()
    if (!universeStore) universeStore = useUniverseStore()
    if (!npcStore) npcStore = useNPCStore()
    return { gameStore, universeStore, npcStore }
  }

  const init = () => {
    if (initialized) return
    if (disposed) {
      console.warn('[GameEngine] Cannot init after dispose')
      return
    }

    // 初始化 stores
    getStores()

    // 初始化脏标志
    dirtyFlags = createDirtyFlags()

    initialized = true
  }

  const tick = async (now: number, deltaMs: number) => {
    if (!initialized) {
      console.warn('[GameEngine] tick called before init')
      return
    }
    if (disposed) return

    profiler.start('tick:total')

    const stores = getStores()

    // 检查暂停状态
    if (stores.gameStore.isPaused) {
      profiler.end('tick:total')
      return
    }

    // 更新游戏时间
    stores.gameStore.gameTime = now

    // 构建 TickContext
    const ctx = createTickContext(
      {
        ...stores,
        t: options.t,
        notify: options.notify,
        notifyUnlock: options.notifyUnlock,
        dirtyFlags: dirtyFlags!
      },
      now,
      deltaMs
    )

    // 调用自定义 tick 处理函数（用于渐进式迁移）
    if (options.onTick) {
      await options.onTick(ctx)
    }

    profiler.end('tick:total')
    profiler.reset() // 重置当前快照，准备下一次 tick
  }

  const pause = () => {
    const { gameStore } = getStores()
    if (!gameStore.isPaused) {
      gameStore.isPaused = true
      options.onPauseChange?.(true)
    }
  }

  const resume = () => {
    const { gameStore } = getStores()
    if (gameStore.isPaused) {
      gameStore.isPaused = false
      options.onPauseChange?.(false)
    }
  }

  const isPaused = () => {
    const { gameStore } = getStores()
    return gameStore.isPaused
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    initialized = false
    gameStore = null
    universeStore = null
    npcStore = null
    dirtyFlags = null
  }

  return {
    init,
    tick,
    pause,
    resume,
    dispose,
    isPaused
  }
}
