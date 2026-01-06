import type { useGameStore } from '@/stores/gameStore'
import type { useUniverseStore } from '@/stores/universeStore'
import type { useNPCStore } from '@/stores/npcStore'
import type { Locale } from '@/locales'
import type { DirtyFlags } from '@/logic/dirtyFlags'
import type { Profiler } from './profiler'
import { profiler as globalProfiler } from './profiler'

/**
 * 翻译函数类型
 */
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

/**
 * 通知回调类型
 */
export type NotifyFn = (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void

/**
 * 解锁项目类型
 */
export interface UnlockedItem {
  type: 'building' | 'technology'
  id: string
  name: string
}

/**
 * 解锁通知回调类型
 */
export type NotifyUnlockFn = (unlockedItems: UnlockedItem[]) => void

/**
 * Tick 上下文接口
 * 集中管理所有 tick 逻辑需要的依赖，避免分散的 imports
 */
export interface TickContext {
  // 时间信息
  now: number
  deltaMs: number
  gameSpeed: number

  // Stores（具体类型化）
  gameStore: ReturnType<typeof useGameStore>
  universeStore: ReturnType<typeof useUniverseStore>
  npcStore: ReturnType<typeof useNPCStore>

  // 国际化
  locale: Locale
  t: TranslateFn

  // 通知服务
  notify: NotifyFn
  notifyUnlock: NotifyUnlockFn

  // 性能优化：脏标志
  dirtyFlags: DirtyFlags

  // 性能分析器（仅开发环境有效）
  profiler: Profiler
}

/**
 * 创建 TickContext 的选项
 */
export interface CreateTickContextOptions {
  gameStore: ReturnType<typeof useGameStore>
  universeStore: ReturnType<typeof useUniverseStore>
  npcStore: ReturnType<typeof useNPCStore>
  t: TranslateFn
  notify?: NotifyFn
  notifyUnlock?: NotifyUnlockFn
  dirtyFlags: DirtyFlags
}

/**
 * 创建 Tick 上下文
 */
export const createTickContext = (options: CreateTickContextOptions, now: number, deltaMs: number): TickContext => {
  const { gameStore, universeStore, npcStore, t, dirtyFlags } = options

  return {
    // 时间信息
    now,
    deltaMs,
    gameSpeed: gameStore.gameSpeed,

    // Stores
    gameStore,
    universeStore,
    npcStore,

    // 国际化
    locale: gameStore.locale,
    t,

    // 通知服务（提供默认空实现）
    notify: options.notify ?? (() => {}),
    notifyUnlock: options.notifyUnlock ?? (() => {}),

    // 性能优化：脏标志
    dirtyFlags,

    // 性能分析器
    profiler: globalProfiler
  }
}
