import type { TickContext } from './tickContext'
import type { NPC } from '@/types/game'
import * as gameLogic from '@/logic/gameLogic'
import * as npcGrowthLogic from '@/logic/npcGrowthLogic'
import * as npcBehaviorLogic from '@/logic/npcBehaviorLogic'
import * as diplomaticLogic from '@/logic/diplomaticLogic'
import { generateNPCName } from '@/logic/npcNameGenerator'

export interface NpcEngine {
  /** 每 tick 调用，处理 NPC 更新 */
  tick(ctx: TickContext): void
  /** 设置每 tick 更新的 NPC 数量 */
  setUpdateSlice(size: number): void
  /** 获取当前 slice 大小 */
  getUpdateSlice(): number
}

export interface NpcEngineOptions {
  /** 每 tick 更新的 NPC 数量（默认 20） */
  sliceSize?: number
  /** Growth 更新间隔（秒，默认 5） */
  growthInterval?: number
  /** Behavior 更新间隔（秒，默认 5） */
  behaviorInterval?: number
  /** 通知回调 */
  onTradeOffer?: (offer: any) => void
  onAttitudeChange?: (notification: any) => void
  onIntelReport?: (report: any) => void
  onJointAttackInvite?: (invite: any) => void
  onAidReceived?: (notification: any) => void
}

/**
 * 创建 NPC 引擎
 * 负责 NPC 成长和行为更新，支持 throttling
 */
export const createNpcEngine = (options: NpcEngineOptions = {}): NpcEngine => {
  const { sliceSize: initialSliceSize = 20, growthInterval = 5, behaviorInterval = 5 } = options

  // 内部状态
  let sliceSize = initialSliceSize
  let growthCursorIndex = 0
  let behaviorCursorIndex = 0
  let growthAccumulator = 0
  let behaviorAccumulator = 0
  let initialized = false

  /**
   * 同步 NPC 星球数据到 universeStore
   */
  const syncNPCPlanetToUniverse = (ctx: TickContext, npc: NPC) => {
    const { universeStore } = ctx
    npc.planets.forEach(npcPlanet => {
      const planetKey = gameLogic.generatePositionKey(npcPlanet.position.galaxy, npcPlanet.position.system, npcPlanet.position.position)
      const universePlanet = universeStore.planets[planetKey]
      if (universePlanet) {
        universePlanet.resources = { ...npcPlanet.resources }
        universePlanet.buildings = { ...npcPlanet.buildings }
        universePlanet.fleet = { ...npcPlanet.fleet }
        universePlanet.defense = { ...npcPlanet.defense }
      }
    })
  }

  /**
   * 初始化 NPC（如果 store 为空）
   */
  const initializeNPCs = (ctx: TickContext) => {
    const { gameStore, universeStore, npcStore } = ctx
    const allPlanets = Object.values(universeStore.planets)

    if (npcStore.npcs.length > 0) {
      initialized = true
      return
    }

    const npcMap = new Map<string, NPC>()
    const now = Date.now()

    allPlanets.forEach(planet => {
      if (planet.ownerId === gameStore.player.id || !planet.ownerId) return

      if (!npcMap.has(planet.ownerId)) {
        const randomSpyOffset = Math.random() * 240 * 1000
        const randomAttackOffset = Math.random() * 480 * 1000

        const initialRelations: Record<string, any> = {}
        initialRelations[gameStore.player.id] = {
          fromId: planet.ownerId,
          toId: gameStore.player.id,
          reputation: 0,
          status: 'neutral' as const,
          lastUpdated: now,
          history: []
        }

        npcMap.set(planet.ownerId, {
          id: planet.ownerId,
          name: generateNPCName(planet.ownerId, gameStore.locale),
          planets: [],
          technologies: {},
          difficulty: 'medium' as const,
          relations: initialRelations,
          allies: [],
          enemies: [],
          lastSpyTime: now - randomSpyOffset,
          lastAttackTime: now - randomAttackOffset,
          fleetMissions: [],
          playerSpyReports: {}
        } as unknown as NPC)
      }

      npcMap.get(planet.ownerId)!.planets.push(planet as any)
    })

    npcStore.npcs = Array.from(npcMap.values())

    if (npcStore.npcs.length > 0) {
      const homeworld = gameStore.player.planets.find(p => !p.isMoon)
      if (homeworld) {
        npcStore.npcs.forEach(npc => {
          npcGrowthLogic.initializeNPCByDistance(npc, homeworld.position)
          syncNPCPlanetToUniverse(ctx, npc)
        })
      }
      npcGrowthLogic.initializeNPCDiplomacy(npcStore.npcs)
    }

    initialized = true
  }

  /**
   * 确保 NPC 数据完整性（修复旧版本数据）
   */
  const ensureNPCDataIntegrity = (ctx: TickContext) => {
    const { gameStore, npcStore } = ctx
    const now = Date.now()
    const homeworld = gameStore.player.planets.find(p => !p.isMoon)

    if (npcStore.npcs.length === 0) return

    // 确保所有 NPC 都有间谍探测器
    npcGrowthLogic.ensureNPCSpyProbes(npcStore.npcs)

    // 确保所有 NPC 都有 AI 类型
    npcGrowthLogic.ensureAllNPCsAIType(npcStore.npcs)

    // 确保所有 NPC 都与玩家建立了关系
    npcStore.npcs.forEach(npc => {
      if (!npc.relations) {
        npc.relations = {}
      }
      if (!npc.relations[gameStore.player.id]) {
        npc.relations[gameStore.player.id] = {
          fromId: npc.id,
          toId: gameStore.player.id,
          reputation: 0,
          status: 'neutral' as const,
          lastUpdated: now,
          history: []
        }
      }

      // 迁移旧存档：如果 NPC 没有距离数据
      if (homeworld && npc.distanceToHomeworld === undefined) {
        const npcPlanet = npc.planets[0]
        if (npcPlanet) {
          npc.distanceToHomeworld = npcGrowthLogic.calculateDistanceToHomeworld(npcPlanet.position, homeworld.position)
          npc.difficultyLevel = npcGrowthLogic.calculateDifficultyLevel(npc.distanceToHomeworld)
          npcGrowthLogic.initializeNPCByDistance(npc, homeworld.position)
          syncNPCPlanetToUniverse(ctx, npc)
        }
      }
    })
  }

  /**
   * 更新 NPC 成长（分片处理）
   */
  const updateGrowth = (ctx: TickContext, elapsedSeconds: number) => {
    const { gameStore, npcStore } = ctx

    if (npcStore.npcs.length === 0) return

    const homeworld = gameStore.player.planets.find(p => !p.isMoon)
    if (!homeworld) return

    // 计算本次要处理的 NPC 范围
    const totalNPCs = npcStore.npcs.length
    const effectiveSlice = Math.min(sliceSize, totalNPCs)
    const startIndex = growthCursorIndex
    const endIndex = Math.min(startIndex + effectiveSlice, totalNPCs)

    // 处理当前分片的 NPC
    for (let i = startIndex; i < endIndex; i++) {
      const npc = npcStore.npcs[i]
      if (!npc) continue
      npcGrowthLogic.updateNPCGrowthByDistance(npc, homeworld.position, elapsedSeconds, gameStore.gameSpeed)
      syncNPCPlanetToUniverse(ctx, npc)
    }

    // 更新游标（循环）
    growthCursorIndex = endIndex >= totalNPCs ? 0 : endIndex
  }

  /**
   * 更新 NPC 行为（分片处理）
   */
  const updateBehavior = (ctx: TickContext) => {
    const { gameStore, universeStore, npcStore, t, notify } = ctx

    if (npcStore.npcs.length === 0) return

    const now = Date.now()
    const allPlanets = [...gameStore.player.planets, ...Object.values(universeStore.planets)]

    // 计算当前活跃任务数量
    let activeSpyMissions = 0
    let activeAttackMissions = 0
    npcStore.npcs.forEach(npc => {
      if (npc.fleetMissions) {
        npc.fleetMissions.forEach(mission => {
          if (mission.status === 'outbound') {
            if (mission.missionType === 'spy') activeSpyMissions++
            else if (mission.missionType === 'attack') activeAttackMissions++
          }
        })
      }
    })

    const config = npcBehaviorLogic.calculateDynamicBehavior(gameStore.player.points)

    // 计算本次要处理的 NPC 范围
    const totalNPCs = npcStore.npcs.length
    const effectiveSlice = Math.min(sliceSize, totalNPCs)
    const startIndex = behaviorCursorIndex
    const endIndex = Math.min(startIndex + effectiveSlice, totalNPCs)

    // 处理当前分片的 NPC（随机顺序处理该分片）
    const sliceNpcs = npcStore.npcs.slice(startIndex, endIndex)
    const shuffledSlice = [...sliceNpcs].sort(() => Math.random() - 0.5)

    shuffledSlice.forEach(npc => {
      npcBehaviorLogic.updateNPCBehaviorWithLimit(npc, gameStore.player, allPlanets, universeStore.debrisFields, now, {
        activeSpyMissions,
        activeAttackMissions,
        config
      })

      // 重新计算并发数
      activeSpyMissions = 0
      activeAttackMissions = 0
      npcStore.npcs.forEach(n => {
        if (n.fleetMissions) {
          n.fleetMissions.forEach(mission => {
            if (mission.status === 'outbound') {
              if (mission.missionType === 'spy') activeSpyMissions++
              else if (mission.missionType === 'attack') activeAttackMissions++
            }
          })
        }
      })

      // 处理增强 NPC 行为
      const relation = npc.relations?.[gameStore.player.id]
      if (relation?.status === 'neutral') {
        const neutralResult = npcBehaviorLogic.updateNeutralNPCBehavior(npc, npcStore.npcs, gameStore.player, now)

        if (neutralResult.tradeOffer) {
          if (!gameStore.player.tradeOffers) {
            gameStore.player.tradeOffers = []
          }
          gameStore.player.tradeOffers.push(neutralResult.tradeOffer)
          options.onTradeOffer?.(neutralResult.tradeOffer)
          notify?.(
            `${t('npcBehavior.tradeOfferReceived')}: ${t('npcBehavior.tradeOfferDesc', { npcName: neutralResult.tradeOffer.npcName })}`,
            'info'
          )
        }

        if (neutralResult.swingDirection) {
          if (!gameStore.player.attitudeChangeNotifications) {
            gameStore.player.attitudeChangeNotifications = []
          }
          const notification = {
            id: `attitude_${Date.now()}_${npc.id}`,
            timestamp: now,
            npcId: npc.id,
            npcName: npc.name,
            previousStatus: 'neutral' as const,
            newStatus: neutralResult.swingDirection,
            reason: 'attitude_swing',
            read: false
          }
          gameStore.player.attitudeChangeNotifications.push(notification)
          options.onAttitudeChange?.(notification)
          const statusKey = neutralResult.swingDirection === 'friendly' ? 'npcBehavior.becameFriendly' : 'npcBehavior.becameHostile'
          notify?.(`${t('npcBehavior.attitudeChanged')}: ${t(statusKey, { npcName: npc.name })}`, 'info')
        }
      } else if (relation?.status === 'friendly') {
        const friendlyResult = npcBehaviorLogic.updateFriendlyNPCBehavior(npc, npcStore.npcs, gameStore.player, now)

        if (friendlyResult.intelReport) {
          if (!gameStore.player.intelReports) {
            gameStore.player.intelReports = []
          }
          gameStore.player.intelReports.push(friendlyResult.intelReport)
          options.onIntelReport?.(friendlyResult.intelReport)
          notify?.(
            `${t('npcBehavior.intelReceived')}: ${t('npcBehavior.intelReceivedDesc', { npcName: friendlyResult.intelReport.fromNpcName })}`,
            'info'
          )
        }

        if (friendlyResult.jointAttackInvite) {
          if (!gameStore.player.jointAttackInvites) {
            gameStore.player.jointAttackInvites = []
          }
          gameStore.player.jointAttackInvites.push(friendlyResult.jointAttackInvite)
          options.onJointAttackInvite?.(friendlyResult.jointAttackInvite)
          notify?.(
            `${t('npcBehavior.jointAttackInvite')}: ${t('npcBehavior.jointAttackInviteDesc', {
              npcName: friendlyResult.jointAttackInvite.fromNpcName
            })}`,
            'info'
          )
        }

        if (friendlyResult.aidProvided) {
          if (!gameStore.player.aidNotifications) {
            gameStore.player.aidNotifications = []
          }
          const notification = {
            id: `aid_${Date.now()}_${npc.id}`,
            timestamp: now,
            npcId: npc.id,
            npcName: npc.name,
            aidResources: friendlyResult.aidProvided,
            read: false
          }
          gameStore.player.aidNotifications.push(notification)
          options.onAidReceived?.(notification)
          const totalAid = friendlyResult.aidProvided.metal + friendlyResult.aidProvided.crystal + friendlyResult.aidProvided.deuterium
          notify?.(
            `${t('npcBehavior.aidReceived')}: ${t('npcBehavior.aidReceivedDesc', {
              npcName: npc.name,
              amount: totalAid.toLocaleString()
            })}`,
            'success'
          )
        }
      }
    })

    // 更新游标（循环）
    behaviorCursorIndex = endIndex >= totalNPCs ? 0 : endIndex
  }

  /**
   * 更新 NPC 关系统计
   */
  const updateRelationStats = (ctx: TickContext) => {
    const { gameStore, npcStore } = ctx
    let friendlyCount = 0
    let hostileCount = 0
    const playerId = gameStore.player.id

    npcStore.npcs.forEach(npc => {
      const relation = npc.relations?.[playerId]
      if (relation) {
        const status = diplomaticLogic.calculateRelationStatus(relation.reputation)
        if (status === 'friendly') friendlyCount++
        else if (status === 'hostile') hostileCount++
      }
    })

    gameLogic.trackDiplomacyStats(gameStore.player, 'updateRelations', {
      friendlyCount,
      hostileCount
    })
  }

  /**
   * 主 tick 函数
   */
  const tick = (ctx: TickContext) => {
    const deltaSeconds = ctx.deltaMs / 1000

    // 初始化 NPC（如果需要）
    if (!initialized) {
      initializeNPCs(ctx)
      ensureNPCDataIntegrity(ctx)
    }

    // 如果没有 NPC，直接返回
    if (ctx.npcStore.npcs.length === 0) return

    // 累积 Growth 时间
    growthAccumulator += deltaSeconds
    if (growthAccumulator >= growthInterval) {
      updateGrowth(ctx, growthAccumulator)
      updateRelationStats(ctx)
      growthAccumulator = 0
    }

    // 累积 Behavior 时间
    behaviorAccumulator += deltaSeconds
    if (behaviorAccumulator >= behaviorInterval) {
      updateBehavior(ctx)
      behaviorAccumulator = 0
    }
  }

  const setUpdateSlice = (size: number) => {
    sliceSize = Math.max(1, size)
  }

  const getUpdateSlice = () => sliceSize

  return {
    tick,
    setUpdateSlice,
    getUpdateSlice
  }
}
