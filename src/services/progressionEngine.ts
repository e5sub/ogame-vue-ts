import type { TickContext } from './tickContext'
import { createScheduler, type Scheduler } from './scheduler'
import * as gameLogic from '@/logic/gameLogic'
import * as campaignLogic from '@/logic/campaignLogic'
import * as diplomaticLogic from '@/logic/diplomaticLogic'

export interface ProgressionEngine {
  /** 初始化引擎，注册所有定时任务 */
  init(ctx: TickContext): void
  /** 每 tick 调用，更新调度器 */
  tick(ctx: TickContext): void
}

export interface ProgressionEngineOptions {
  /** 成就检查间隔（毫秒，默认 5000） */
  achievementInterval?: number
  /** 战役进度检查间隔（毫秒，默认 5000） */
  campaignInterval?: number
  /** 外交清理间隔（毫秒，默认 15000） */
  diplomacyCleanupInterval?: number
  /** 成就解锁通知回调 */
  onAchievementUnlock?: (unlock: { id: string; tier: string }) => void
}

/**
 * 创建进度引擎
 * 负责低频任务调度：成就检查、战役进度、外交清理等
 */
export const createProgressionEngine = (options: ProgressionEngineOptions = {}): ProgressionEngine => {
  const {
    achievementInterval = 5000,
    campaignInterval = 5000,
    diplomacyCleanupInterval = 15000
  } = options

  const scheduler: Scheduler = createScheduler()
  let initialized = false
  // 保存最新的 context 引用，供调度任务使用
  let currentCtx: TickContext | null = null

  /**
   * 检查成就解锁
   */
  const checkAchievements = () => {
    if (!currentCtx) return
    const { gameStore } = currentCtx

    const unlocks = gameLogic.checkAndUnlockAchievements(gameStore.player)

    // 触发解锁通知
    unlocks.forEach(unlock => {
      options.onAchievementUnlock?.(unlock)
    })
  }

  /**
   * 检查战役任务进度
   */
  const checkCampaignProgress = () => {
    if (!currentCtx) return
    const { gameStore, npcStore } = currentCtx

    if (gameStore.player.campaignProgress) {
      campaignLogic.checkAllActiveQuestsProgress(gameStore.player, npcStore.npcs)
    }
  }

  /**
   * 清理被消灭的 NPC（外交清理）
   */
  const cleanupEliminatedNPCs = () => {
    if (!currentCtx) return
    const { gameStore, universeStore, npcStore } = currentCtx

    const eliminatedNpcIds = diplomaticLogic.checkAndHandleEliminatedNPCs(
      npcStore.npcs,
      gameStore.player,
      gameStore.locale
    )

    if (eliminatedNpcIds.length === 0) return

    // 从 universeStore 中移除被消灭 NPC 的星球数据，并收集需要清理的任务 ID
    const missionIdsToRemove: string[] = []

    eliminatedNpcIds.forEach(npcId => {
      const npc = npcStore.npcs.find(n => n.id === npcId)
      if (npc) {
        // 遍历 NPC 的所有星球，从 universeStore 中删除
        if (npc.planets) {
          npc.planets.forEach(planet => {
            const planetKey = gameLogic.generatePositionKey(
              planet.position.galaxy,
              planet.position.system,
              planet.position.position
            )
            if (universeStore.planets[planetKey]) {
              delete universeStore.planets[planetKey]
            }
          })
        }
        // 收集该 NPC 所有任务的 ID（用于清理玩家的警报）
        if (npc.fleetMissions) {
          npc.fleetMissions.forEach(m => missionIdsToRemove.push(m.id))
        }
      }
    })

    // 清理玩家的即将到来舰队警报（移除已消灭 NPC 的任务警报）
    if (gameStore.player.incomingFleetAlerts && missionIdsToRemove.length > 0) {
      gameStore.player.incomingFleetAlerts = gameStore.player.incomingFleetAlerts.filter(
        alert => !missionIdsToRemove.includes(alert.id)
      )
    }

    // 从 NPC 列表中移除被消灭的 NPC
    npcStore.npcs = npcStore.npcs.filter(npc => !eliminatedNpcIds.includes(npc.id))
  }

  /**
   * 初始化引擎，注册所有定时任务
   */
  const init = (ctx: TickContext): void => {
    if (initialized) return

    currentCtx = ctx

    // 注册定时任务
    scheduler.every(achievementInterval, checkAchievements)
    scheduler.every(campaignInterval, checkCampaignProgress)
    scheduler.every(diplomacyCleanupInterval, cleanupEliminatedNPCs)

    initialized = true
  }

  /**
   * 每 tick 调用，更新调度器
   */
  const tick = (ctx: TickContext): void => {
    // 更新 context 引用
    currentCtx = ctx

    // 执行调度器 tick
    scheduler.tick(ctx.now)
  }

  return {
    init,
    tick
  }
}
