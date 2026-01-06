import type { TickContext } from './tickContext'
import type { UnlockedItem } from '@/logic/unlockLogic'
import * as gameLogic from '@/logic/gameLogic'
import { markEconomyDirty, markQueuesDirty } from '@/logic/dirtyFlags'

export interface EconomyEngine {
  /** 每 tick 调用，处理资源生产和队列完成 */
  tick(ctx: TickContext): void
}

export interface EconomyEngineOptions {
  /** 完成回调（建筑/科技/船舰/防御） */
  onNotification?: (type: string, itemType: string, level?: number) => void
  /** 解锁回调 */
  onUnlock?: (unlockedItems: UnlockedItem[]) => void
}

/**
 * 创建经济引擎
 * 负责资源生产、建筑队列、研究队列、等待队列的处理
 */
export const createEconomyEngine = (options: EconomyEngineOptions = {}): EconomyEngine => {
  /**
   * 主 tick 函数
   * 处理资源生产、队列完成
   */
  const tick = (ctx: TickContext) => {
    const { gameStore, now, dirtyFlags } = ctx

    // 记录队列长度以检测完成
    const prevResearchQueueLen = gameStore.player.researchQueue.length
    const prevBuildQueueLens = gameStore.player.planets.map(p => p.buildQueue.length)

    // 检查军官过期
    gameLogic.checkOfficersExpiration(gameStore.player.officers, now)

    // 处理游戏更新（资源生产、建造队列、研究队列、等待队列）
    const result = gameLogic.processGameUpdate(gameStore.player, now, gameStore.gameSpeed, options.onNotification, options.onUnlock)

    // 更新研究队列（processGameUpdate 内部已处理，但需要同步到 store）
    gameStore.player.researchQueue = result.updatedResearchQueue

    // 检测是否有队列完成（通过长度变化）
    const researchCompleted = result.updatedResearchQueue.length < prevResearchQueueLen
    const buildingCompleted = gameStore.player.planets.some((p, i) => p.buildQueue.length < (prevBuildQueueLens[i] ?? 0))

    // 如果有队列完成，标记相关标志
    if (researchCompleted || buildingCompleted) {
      markEconomyDirty(dirtyFlags) // 建筑/研究完成可能影响资源生产
      markQueuesDirty(dirtyFlags) // 队列状态已改变
    }
  }

  return {
    tick
  }
}
