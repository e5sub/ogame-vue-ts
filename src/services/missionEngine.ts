import type { TickContext } from './tickContext'
import type { FleetMission, MissileAttack, NPC, MissionReport, Planet } from '@/types/game'
import { MissionType, DiplomaticEventType, ShipType } from '@/types/game'
import { DIPLOMATIC_CONFIG } from '@/config/gameConfig'
import * as fleetLogic from '@/logic/fleetLogic'
import * as shipLogic from '@/logic/shipLogic'
import * as resourceLogic from '@/logic/resourceLogic'
import * as gameLogic from '@/logic/gameLogic'
import * as npcBehaviorLogic from '@/logic/npcBehaviorLogic'
import * as diplomaticLogic from '@/logic/diplomaticLogic'
import * as missileLogic from '@/logic/missileLogic' // 静态导入，避免每次动态导入的开销
import { markFleetDirty, markEconomyDirty, markNpcDirty } from '@/logic/dirtyFlags'

export interface MissionEngine {
  /** 处理所有任务的 tick */
  tick(ctx: TickContext): Promise<void>
}

export interface MissionEngineOptions {
  /** 移除即将到来的舰队警报 */
  removeIncomingFleetAlert?: (missionId: string) => void
}

/**
 * 创建任务引擎
 * 处理玩家和NPC的舰队任务、导弹攻击
 */
export const createMissionEngine = (options: MissionEngineOptions = {}): MissionEngine => {
  const removeIncomingFleetAlert = options.removeIncomingFleetAlert ?? (() => {})

  // 缓存 NPC 最早到达时间，避免每 tick 遍历所有 NPC
  let cachedNpcEarliestArrival = Number.MAX_SAFE_INTEGER

  /**
   * 处理玩家任务返回
   */
  const processPlayerMissionReturn = (ctx: TickContext, mission: FleetMission) => {
    const { gameStore } = ctx
    const originPlanet = gameStore.player.planets.find(p => p.id === mission.originPlanetId)
    if (!originPlanet) return

    // 返还舰队和货物
    shipLogic.addFleet(originPlanet.fleet, mission.fleet)
    resourceLogic.addResources(originPlanet.resources, mission.cargo)

    // 从任务列表中移除
    const missionIndex = gameStore.player.fleetMissions.indexOf(mission)
    if (missionIndex > -1) {
      gameStore.player.fleetMissions.splice(missionIndex, 1)
    }
  }

  /**
   * 查找目标星球
   */
  const findTargetPlanet = (ctx: TickContext, mission: FleetMission): Planet | undefined => {
    const { gameStore, universeStore } = ctx
    const targetKey = gameLogic.generatePositionKey(
      mission.targetPosition.galaxy,
      mission.targetPosition.system,
      mission.targetPosition.position
    )

    // 先从玩家星球中查找，再从宇宙地图中查找
    // 如果任务指定了targetIsMoon，需要精确匹配行星或月球
    return (
      gameStore.player.planets.find(p => {
        const positionMatch =
          p.position.galaxy === mission.targetPosition.galaxy &&
          p.position.system === mission.targetPosition.system &&
          p.position.position === mission.targetPosition.position
        // 如果任务明确指定目标类型，按类型匹配
        if (mission.targetIsMoon !== undefined) {
          return positionMatch && p.isMoon === mission.targetIsMoon
        }
        // 兼容旧任务：默认优先匹配行星（非月球）
        return positionMatch && !p.isMoon
      }) ||
      // 如果没有匹配到指定类型，尝试匹配同位置的任何星球
      gameStore.player.planets.find(
        p =>
          p.position.galaxy === mission.targetPosition.galaxy &&
          p.position.system === mission.targetPosition.system &&
          p.position.position === mission.targetPosition.position
      ) ||
      universeStore.planets[targetKey]
    )
  }

  /**
   * 处理玩家任务到达
   */
  const processPlayerMissionArrival = async (ctx: TickContext, mission: FleetMission) => {
    const { gameStore, universeStore, npcStore, t } = ctx

    const targetPlanet = findTargetPlanet(ctx, mission)
    const targetKey = gameLogic.generatePositionKey(
      mission.targetPosition.galaxy,
      mission.targetPosition.system,
      mission.targetPosition.position
    )

    // 获取起始星球名称（用于报告）
    const originPlanet = gameStore.player.planets.find(p => p.id === mission.originPlanetId)
    const originPlanetName = originPlanet?.name || t('fleetView.unknownPlanet')

    // 确保 missionReports 存在
    if (!gameStore.player.missionReports) {
      gameStore.player.missionReports = []
    }

    if (mission.missionType === MissionType.Transport) {
      // 在处理任务之前保存货物信息（因为processTransportArrival会清空cargo）
      const transportedResources = { ...mission.cargo }
      const isGiftMission = mission.isGift && mission.giftTargetNpcId
      const result = fleetLogic.processTransportArrival(mission, targetPlanet, gameStore.player, npcStore.npcs)

      // 更新成就统计（仅在成功时追踪）
      if (result.success) {
        const totalTransported =
          transportedResources.metal + transportedResources.crystal + transportedResources.deuterium + transportedResources.darkMatter
        if (isGiftMission) {
          // 送礼成功
          gameLogic.trackDiplomacyStats(gameStore.player, 'gift', { resourcesAmount: totalTransported })
        } else {
          // 普通运输任务成功
          gameLogic.trackMissionStats(gameStore.player, 'transport', { resourcesAmount: totalTransported })
        }
      }

      // 生成失败原因消息
      let transportFailMessage = t('missionReports.transportFailed')
      if (!result.success && result.failReason) {
        if (result.failReason === 'targetNotFound') {
          transportFailMessage = t('missionReports.transportFailedTargetNotFound')
        } else if (result.failReason === 'giftRejected') {
          transportFailMessage = t('missionReports.transportFailedGiftRejected')
        }
      }

      // 生成运输任务报告
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Transport,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        targetPlanetId: targetPlanet?.id,
        targetPlanetName:
          targetPlanet?.name || `[${mission.targetPosition.galaxy}:${mission.targetPosition.system}:${mission.targetPosition.position}]`,
        success: result.success,
        message: result.success ? t('missionReports.transportSuccess') : transportFailMessage,
        details: {
          transportedResources,
          failReason: result.failReason
        },
        read: false
      })
    } else if (mission.missionType === MissionType.Attack) {
      const attackResult = await fleetLogic.processAttackArrival(mission, targetPlanet, gameStore.player, null, gameStore.player.planets)
      if (attackResult) {
        gameStore.player.battleReports.push(attackResult.battleResult)

        // 更新成就统计 - 攻击
        const debrisValue = attackResult.debrisField
          ? attackResult.debrisField.resources.metal + attackResult.debrisField.resources.crystal
          : 0
        const won = attackResult.battleResult.winner === 'attacker'
        gameLogic.trackAttackStats(gameStore.player, attackResult.battleResult, won, debrisValue)

        // 检查是否攻击了NPC星球，更新外交关系
        if (targetPlanet) {
          const targetNpc = npcStore.npcs.find(npc => npc.planets.some(p => p.id === targetPlanet.id))
          if (targetNpc) {
            diplomaticLogic.handleAttackReputation(gameStore.player, targetNpc, attackResult.battleResult, npcStore.npcs, gameStore.locale)

            // 同步战斗损失到NPC的实际星球数据
            const npcPlanet = targetNpc.planets.find(p => p.id === targetPlanet.id)
            if (npcPlanet) {
              // 同步舰队损失
              Object.entries(attackResult.battleResult.defenderLosses.fleet).forEach(([shipType, lost]) => {
                npcPlanet.fleet[shipType as ShipType] = Math.max(0, (npcPlanet.fleet[shipType as ShipType] || 0) - lost)
              })
              // 同步防御损失（修复后的数据已在targetPlanet中）
              npcPlanet.defense = { ...targetPlanet.defense }
              // 同步资源（被掠夺后的）
              npcPlanet.resources = { ...targetPlanet.resources }
            }
          }
        }

        if (attackResult.moon) {
          gameStore.player.planets.push(attackResult.moon)
        }
        if (attackResult.debrisField) {
          // 将残骸场添加到游戏状态
          universeStore.debrisFields[attackResult.debrisField.id] = attackResult.debrisField
        }
      }
    } else if (mission.missionType === MissionType.Colonize) {
      const colonizeResult = fleetLogic.processColonizeArrival(mission, targetPlanet, gameStore.player, t('planet.colonyPrefix'))
      const newPlanet = colonizeResult.planet

      // 更新成就统计 - 殖民
      if (colonizeResult.success && newPlanet) {
        gameLogic.trackMissionStats(gameStore.player, 'colonize')
      }

      // 生成失败原因消息
      let failMessage = t('missionReports.colonizeFailed')
      if (!colonizeResult.success && colonizeResult.failReason) {
        if (colonizeResult.failReason === 'positionOccupied') {
          failMessage = t('missionReports.colonizeFailedOccupied')
        } else if (colonizeResult.failReason === 'maxColoniesReached') {
          failMessage = t('missionReports.colonizeFailedMaxColonies')
        }
      }

      // 生成殖民任务报告
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Colonize,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        targetPlanetId: newPlanet?.id,
        targetPlanetName: newPlanet?.name,
        success: colonizeResult.success,
        message: colonizeResult.success ? t('missionReports.colonizeSuccess') : failMessage,
        details: newPlanet
          ? {
              newPlanetId: newPlanet.id,
              newPlanetName: newPlanet.name
            }
          : { failReason: colonizeResult.failReason },
        read: false
      })
      if (newPlanet) {
        gameStore.player.planets.push(newPlanet)
      }
    } else if (mission.missionType === MissionType.Spy) {
      const spyResult = fleetLogic.processSpyArrival(mission, targetPlanet, gameStore.player, null, npcStore.npcs)
      if (spyResult.success && spyResult.report) {
        gameStore.player.spyReports.push(spyResult.report)
        // 更新成就统计 - 侦查
        gameLogic.trackMissionStats(gameStore.player, 'spy')
      }

      // 生成侦查任务报告（即使失败也生成）
      let spyFailMessage = t('missionReports.spyFailed')
      if (!spyResult.success && spyResult.failReason) {
        if (spyResult.failReason === 'targetNotFound') {
          spyFailMessage = t('missionReports.spyFailedTargetNotFound')
        }
      }

      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Spy,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        targetPlanetId: targetPlanet?.id,
        targetPlanetName:
          targetPlanet?.name || `[${mission.targetPosition.galaxy}:${mission.targetPosition.system}:${mission.targetPosition.position}]`,
        success: spyResult.success,
        message: spyResult.success ? t('missionReports.spySuccess') : spyFailMessage,
        details: spyResult.success ? { spyReportId: spyResult.report?.id } : { failReason: spyResult.failReason },
        read: false
      })
    } else if (mission.missionType === MissionType.Deploy) {
      const deployed = fleetLogic.processDeployArrival(mission, targetPlanet, gameStore.player.id, gameStore.player.technologies)

      // 更新成就统计 - 部署
      if (deployed.success) {
        gameLogic.trackMissionStats(gameStore.player, 'deploy')
      }

      // 生成失败原因消息
      let deployFailMessage = t('missionReports.deployFailed')
      if (!deployed.success && deployed.failReason) {
        if (deployed.failReason === 'targetNotFound') {
          deployFailMessage = t('missionReports.deployFailedTargetNotFound')
        } else if (deployed.failReason === 'notOwnPlanet') {
          deployFailMessage = t('missionReports.deployFailedNotOwnPlanet')
        }
      }

      // 生成部署任务报告
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Deploy,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        targetPlanetId: targetPlanet?.id,
        targetPlanetName:
          targetPlanet?.name || `[${mission.targetPosition.galaxy}:${mission.targetPosition.system}:${mission.targetPosition.position}]`,
        success: deployed.success,
        message: deployed.success ? t('missionReports.deploySuccess') : deployFailMessage,
        details: {
          deployedFleet: mission.fleet,
          failReason: deployed.failReason
        },
        read: false
      })
      if (deployed.success && !deployed.overflow) {
        const missionIndex = gameStore.player.fleetMissions.indexOf(mission)
        if (missionIndex > -1) gameStore.player.fleetMissions.splice(missionIndex, 1)
        return
      }
    } else if (mission.missionType === MissionType.Recycle) {
      // 处理回收任务
      const debrisId = `debris_${mission.targetPosition.galaxy}_${mission.targetPosition.system}_${mission.targetPosition.position}`
      const debrisField = universeStore.debrisFields[debrisId]
      const recycleResult = fleetLogic.processRecycleArrival(mission, debrisField)

      // 更新成就统计 - 回收（无论是否有残骸都算飞行任务，但只有成功回收才计入回收资源量）
      const totalRecycled =
        recycleResult.success && recycleResult.collectedResources
          ? recycleResult.collectedResources.metal + recycleResult.collectedResources.crystal
          : 0
      gameLogic.trackMissionStats(gameStore.player, 'recycle', { resourcesAmount: totalRecycled })

      // 生成失败原因消息
      let recycleFailMessage = t('missionReports.recycleFailed')
      if (!recycleResult.success && recycleResult.failReason) {
        if (recycleResult.failReason === 'noDebrisField') {
          recycleFailMessage = t('missionReports.recycleFailedNoDebris')
        } else if (recycleResult.failReason === 'debrisEmpty') {
          recycleFailMessage = t('missionReports.recycleFailedDebrisEmpty')
        }
      }

      // 生成回收任务报告
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Recycle,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        success: recycleResult.success,
        message: recycleResult.success ? t('missionReports.recycleSuccess') : recycleFailMessage,
        details: recycleResult.success
          ? {
              recycledResources: recycleResult.collectedResources,
              remainingDebris: recycleResult.remainingDebris || undefined
            }
          : { failReason: recycleResult.failReason },
        read: false
      })

      if (recycleResult.success && recycleResult.collectedResources && debrisField) {
        if (recycleResult.remainingDebris && (recycleResult.remainingDebris.metal > 0 || recycleResult.remainingDebris.crystal > 0)) {
          // 更新残骸场
          universeStore.debrisFields[debrisId] = {
            id: debrisField.id,
            position: debrisField.position,
            resources: recycleResult.remainingDebris,
            createdAt: debrisField.createdAt,
            expiresAt: debrisField.expiresAt
          }
        } else {
          // 残骸场已被完全收集，删除
          delete universeStore.debrisFields[debrisId]
        }
      }
    } else if (mission.missionType === MissionType.Destroy) {
      // 处理行星毁灭任务（需要先战斗，再计算毁灭概率）
      const destroyResult = await fleetLogic.processDestroyArrival(mission, targetPlanet, gameStore.player, null, gameStore.player.planets)

      // 处理战斗报告（如果发生了战斗）
      if (destroyResult.battleResult) {
        gameStore.player.battleReports.push(destroyResult.battleResult)

        // 处理战斗对NPC的影响
        if (targetPlanet) {
          const targetNpc = npcStore.npcs.find(npc => npc.planets.some(p => p.id === targetPlanet.id))
          if (targetNpc) {
            diplomaticLogic.handleAttackReputation(gameStore.player, targetNpc, destroyResult.battleResult, npcStore.npcs, gameStore.locale)

            // 同步战斗损失到NPC的实际星球数据
            const npcPlanet = targetNpc.planets.find(p => p.id === targetPlanet.id)
            if (npcPlanet) {
              Object.entries(destroyResult.battleResult.defenderLosses.fleet).forEach(([shipType, lost]) => {
                npcPlanet.fleet[shipType as ShipType] = Math.max(0, (npcPlanet.fleet[shipType as ShipType] || 0) - lost)
              })
              npcPlanet.defense = { ...targetPlanet.defense }
              npcPlanet.resources = { ...targetPlanet.resources }
            }
          }
        }
      }

      // 处理新生成的月球
      if (destroyResult.moon) {
        gameStore.player.planets.push(destroyResult.moon)
      }

      // 处理残骸场
      if (destroyResult.debrisField) {
        universeStore.debrisFields[destroyResult.debrisField.id] = destroyResult.debrisField
      }

      // 更新成就统计 - 行星毁灭
      if (destroyResult.success) {
        gameLogic.trackMissionStats(gameStore.player, 'destroy')
      }

      // 生成失败原因消息
      let destroyFailMessage = t('missionReports.destroyFailed')
      if (!destroyResult.success && destroyResult.failReason) {
        if (destroyResult.failReason === 'targetNotFound') {
          destroyFailMessage = t('missionReports.destroyFailedTargetNotFound')
        } else if (destroyResult.failReason === 'ownPlanet') {
          destroyFailMessage = t('missionReports.destroyFailedOwnPlanet')
        } else if (destroyResult.failReason === 'noDeathstar') {
          destroyFailMessage = t('missionReports.destroyFailedNoDeathstar')
        } else if (destroyResult.failReason === 'chanceFailed') {
          destroyFailMessage = t('missionReports.destroyFailedChance', { chance: destroyResult.destructionChance.toFixed(1) })
        }
      }

      // 生成毁灭任务报告
      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Destroy,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        targetPlanetId: targetPlanet?.id,
        targetPlanetName: targetPlanet?.name,
        success: destroyResult.success,
        message: destroyResult.success ? t('missionReports.destroySuccess') : destroyFailMessage,
        details: destroyResult.success
          ? {
              destroyedPlanetName:
                targetPlanet?.name ||
                `[${mission.targetPosition.galaxy}:${mission.targetPosition.system}:${mission.targetPosition.position}]`,
              hadBattle: !!destroyResult.battleResult
            }
          : {
              failReason: destroyResult.failReason,
              destructionChance: destroyResult.destructionChance,
              deathstarsLost: destroyResult.deathstarsLost,
              hadBattle: !!destroyResult.battleResult
            },
        read: false
      })

      if (destroyResult.success && destroyResult.planetId) {
        // 星球被摧毁

        // 处理外交关系（如果目标是NPC星球）
        if (targetPlanet && targetPlanet.ownerId) {
          const planetOwner = npcStore.npcs.find(npc => npc.id === targetPlanet.ownerId)
          if (planetOwner) {
            diplomaticLogic.handlePlanetDestructionReputation(gameStore.player, targetPlanet, planetOwner, npcStore.npcs, gameStore.locale)

            // 从NPC的星球列表中移除被摧毁的星球
            const npcPlanetIndex = planetOwner.planets.findIndex(p => p.id === destroyResult.planetId)
            if (npcPlanetIndex > -1) {
              planetOwner.planets.splice(npcPlanetIndex, 1)
            }

            // 检查并处理被消灭的NPC（所有星球都被摧毁的NPC）
            const eliminatedNpcIds = diplomaticLogic.checkAndHandleEliminatedNPCs(npcStore.npcs, gameStore.player, gameStore.locale)

            // 从npcStore中移除被消灭的NPC
            if (eliminatedNpcIds.length > 0) {
              npcStore.npcs = npcStore.npcs.filter(npc => !eliminatedNpcIds.includes(npc.id))
            }
          }
        }

        // 从玩家星球列表中移除（如果是玩家的星球）
        const planetIndex = gameStore.player.planets.findIndex(p => p.id === destroyResult.planetId)
        if (planetIndex > -1) {
          gameStore.player.planets.splice(planetIndex, 1)
        } else {
          // 不是玩家星球，从宇宙地图中移除
          delete universeStore.planets[targetKey]
        }

        // 取消所有前往该位置的NPC任务（回收、攻击、侦查等）
        const destroyedDebrisId = `debris_${mission.targetPosition.galaxy}_${mission.targetPosition.system}_${mission.targetPosition.position}`
        npcStore.npcs.forEach(npc => {
          if (npc.fleetMissions) {
            // 找到需要取消的任务（前往已摧毁星球位置的outbound任务）
            const missionsToCancel = npc.fleetMissions.filter(m => {
              if (m.status !== 'outbound') return false
              // 检查回收任务的残骸场ID
              if (m.missionType === MissionType.Recycle && m.debrisFieldId === destroyedDebrisId) {
                return true
              }
              // 检查其他任务的目标星球ID
              if (m.targetPlanetId === destroyResult.planetId) {
                return true
              }
              return false
            })

            // 将这些任务的舰队返回给NPC
            missionsToCancel.forEach(m => {
              const npcOriginPlanet = npc.planets.find(p => p.id === m.originPlanetId)
              if (npcOriginPlanet) {
                shipLogic.addFleet(npcOriginPlanet.fleet, m.fleet)
              }
            })

            // 从任务列表中移除这些任务
            npc.fleetMissions = npc.fleetMissions.filter(m => !missionsToCancel.includes(m))
          }

          // 清理关于被摧毁星球的侦查报告
          if (npc.playerSpyReports && destroyResult.planetId && destroyResult.planetId in npc.playerSpyReports) {
            delete npc.playerSpyReports[destroyResult.planetId]
          }
        })

        // 同时删除该位置的残骸场（星球被摧毁后残骸场也消失）
        delete universeStore.debrisFields[destroyedDebrisId]
      }
    } else if (mission.missionType === MissionType.Expedition) {
      // 处理探险任务
      const expeditionResult = fleetLogic.processExpeditionArrival(mission)

      // 确保返回时间正确设置（兼容旧版本任务数据）
      // 如果 returnTime 不存在或已过期，重新计算
      const now = Date.now()
      if (!mission.returnTime || mission.returnTime <= now) {
        // 返回时间应该等于当前时间加上单程飞行时间
        const flightDuration = mission.arrivalTime - mission.departureTime
        mission.returnTime = now + flightDuration
      }

      // 更新成就统计 - 探险
      const isSuccessful =
        expeditionResult.eventType === 'resources' || expeditionResult.eventType === 'darkMatter' || expeditionResult.eventType === 'fleet'
      gameLogic.trackMissionStats(gameStore.player, 'expedition', { successful: isSuccessful })

      // 根据事件类型生成不同的报告消息
      let reportMessage = ''
      let reportDetails: Record<string, unknown> = {
        // 保存探险区域信息
        expeditionZone: mission.expeditionZone
      }

      switch (expeditionResult.eventType) {
        case 'resources':
          reportMessage = t('missionReports.expeditionResources')
          reportDetails.foundResources = expeditionResult.resources
          break
        case 'darkMatter':
          reportMessage = t('missionReports.expeditionDarkMatter')
          reportDetails.foundResources = expeditionResult.resources
          break
        case 'fleet':
          reportMessage = t('missionReports.expeditionFleet')
          reportDetails.foundFleet = expeditionResult.fleet
          break
        case 'pirates':
          reportMessage = expeditionResult.fleetLost
            ? t('missionReports.expeditionPiratesAttack')
            : t('missionReports.expeditionPiratesEscaped')
          if (expeditionResult.fleetLost) reportDetails.fleetLost = expeditionResult.fleetLost
          break
        case 'aliens':
          reportMessage = expeditionResult.fleetLost
            ? t('missionReports.expeditionAliensAttack')
            : t('missionReports.expeditionAliensEscaped')
          if (expeditionResult.fleetLost) reportDetails.fleetLost = expeditionResult.fleetLost
          break
        default:
          reportMessage = t('missionReports.expeditionNothing')
      }

      gameStore.player.missionReports.push({
        id: `mission-report-${mission.id}`,
        timestamp: Date.now(),
        missionType: MissionType.Expedition,
        originPlanetId: mission.originPlanetId,
        originPlanetName,
        targetPosition: mission.targetPosition,
        success: expeditionResult.eventType !== 'nothing',
        message: reportMessage,
        details: reportDetails,
        read: false
      })
    }
  }

  /**
   * 处理NPC任务到达
   */
  const processNPCMissionArrival = async (ctx: TickContext, npc: NPC, mission: FleetMission) => {
    const { gameStore, universeStore } = ctx

    if (mission.missionType === MissionType.Recycle) {
      // NPC回收任务
      const debrisId = mission.debrisFieldId
      if (!debrisId) {
        console.warn('[NPC Mission] Recycle mission missing debrisFieldId')
        mission.status = 'returning'
        mission.returnTime = Date.now() + (mission.arrivalTime - mission.departureTime)
        return
      }

      const debrisField = universeStore.debrisFields[debrisId]
      const recycleResult = fleetLogic.processRecycleArrival(mission, debrisField)

      if (recycleResult && debrisField && recycleResult.collectedResources) {
        const totalRecycled = recycleResult.collectedResources.metal + recycleResult.collectedResources.crystal
        if (totalRecycled > 0) {
          gameLogic.trackDiplomacyStats(gameStore.player, 'debrisRecycledByNPC', { resourcesAmount: totalRecycled })
        }

        if (recycleResult.remainingDebris && (recycleResult.remainingDebris.metal > 0 || recycleResult.remainingDebris.crystal > 0)) {
          universeStore.debrisFields[debrisId] = {
            id: debrisField.id,
            position: debrisField.position,
            resources: recycleResult.remainingDebris,
            createdAt: debrisField.createdAt
          }
        } else {
          delete universeStore.debrisFields[debrisId]
        }
      }

      removeIncomingFleetAlert(mission.id)
      mission.returnTime = Date.now() + (mission.arrivalTime - mission.departureTime)
      return
    }

    // 找到目标星球
    const targetKey = gameLogic.generatePositionKey(
      mission.targetPosition.galaxy,
      mission.targetPosition.system,
      mission.targetPosition.position
    )
    const targetPlanet =
      gameStore.player.planets.find(
        p =>
          p.position.galaxy === mission.targetPosition.galaxy &&
          p.position.system === mission.targetPosition.system &&
          p.position.position === mission.targetPosition.position
      ) || universeStore.planets[targetKey]

    if (!targetPlanet) {
      console.warn('[NPC Mission] Target planet not found')
      return
    }

    if (mission.missionType === MissionType.Spy) {
      // NPC侦查
      const { spiedNotification, spyReport } = npcBehaviorLogic.processNPCSpyArrival(npc, mission, targetPlanet, gameStore.player)

      gameLogic.trackDiplomacyStats(gameStore.player, 'spiedByNPC')

      if (!npc.playerSpyReports) {
        npc.playerSpyReports = {}
      }
      npc.playerSpyReports[targetPlanet.id] = spyReport

      if (!gameStore.player.spiedNotifications) {
        gameStore.player.spiedNotifications = []
      }
      gameStore.player.spiedNotifications.push(spiedNotification)

      removeIncomingFleetAlert(mission.id)
    } else if (mission.missionType === MissionType.Attack) {
      // NPC攻击
      const attackResult = await fleetLogic.processNPCAttackArrival(npc, mission, targetPlanet, gameStore.player, gameStore.player.planets)

      if (attackResult) {
        gameLogic.trackDiplomacyStats(gameStore.player, 'attackedByNPC')
        const debrisValue = attackResult.debrisField
          ? attackResult.debrisField.resources.metal + attackResult.debrisField.resources.crystal
          : 0
        const won = attackResult.battleResult.winner === 'defender'
        gameLogic.trackDefenseStats(gameStore.player, attackResult.battleResult, won, debrisValue)

        gameStore.player.battleReports.push(attackResult.battleResult)

        if (attackResult.moon) {
          gameStore.player.planets.push(attackResult.moon)
        }

        if (attackResult.debrisField) {
          const existingDebris = universeStore.debrisFields[attackResult.debrisField.id]
          if (existingDebris) {
            universeStore.debrisFields[attackResult.debrisField.id] = {
              ...existingDebris,
              resources: {
                metal: existingDebris.resources.metal + attackResult.debrisField.resources.metal,
                crystal: existingDebris.resources.crystal + attackResult.debrisField.resources.crystal
              }
            }
          } else {
            universeStore.debrisFields[attackResult.debrisField.id] = attackResult.debrisField
          }
        }
      }

      removeIncomingFleetAlert(mission.id)
    }
  }

  /**
   * 处理NPC任务返回
   */
  const processNPCMissionReturn = (_ctx: TickContext, npc: NPC, mission: FleetMission) => {
    const originPlanet = npc.planets.find(p => p.id === mission.originPlanetId)
    if (!originPlanet) return

    // 返还舰队
    shipLogic.addFleet(originPlanet.fleet, mission.fleet)

    // 返还掠夺资源
    if (mission.cargo) {
      originPlanet.resources.metal += mission.cargo.metal
      originPlanet.resources.crystal += mission.cargo.crystal
      originPlanet.resources.deuterium += mission.cargo.deuterium
    }

    // 从NPC任务列表中移除
    if (npc.fleetMissions) {
      const missionIndex = npc.fleetMissions.indexOf(mission)
      if (missionIndex > -1) {
        npc.fleetMissions.splice(missionIndex, 1)
      }
    }
  }

  /**
   * 处理导弹攻击到达
   */
  const processMissileAttackArrival = (ctx: TickContext, missileAttack: MissileAttack) => {
    const { gameStore, universeStore, npcStore, t } = ctx
    // missileLogic 已在顶部静态导入

    // 找到目标星球
    const targetKey = gameLogic.generatePositionKey(
      missileAttack.targetPosition.galaxy,
      missileAttack.targetPosition.system,
      missileAttack.targetPosition.position
    )
    const targetPlanet =
      gameStore.player.planets.find(
        p =>
          p.position.galaxy === missileAttack.targetPosition.galaxy &&
          p.position.system === missileAttack.targetPosition.system &&
          p.position.position === missileAttack.targetPosition.position
      ) || universeStore.planets[targetKey]

    // 确保 missionReports 存在
    if (!gameStore.player.missionReports) {
      gameStore.player.missionReports = []
    }

    const originPlanetName = gameStore.player.planets.find(p => p.id === missileAttack.originPlanetId)?.name || t('fleetView.unknownPlanet')

    // 如果目标星球不存在，导弹失败
    if (!targetPlanet) {
      missileAttack.status = 'arrived'
      gameStore.player.missionReports.push({
        id: `missile-report-${missileAttack.id}`,
        timestamp: Date.now(),
        missionType: MissionType.MissileAttack,
        originPlanetId: missileAttack.originPlanetId,
        originPlanetName,
        targetPosition: missileAttack.targetPosition,
        targetPlanetId: undefined,
        targetPlanetName: `[${missileAttack.targetPosition.galaxy}:${missileAttack.targetPosition.system}:${missileAttack.targetPosition.position}]`,
        success: false,
        message: t('missionReports.missileAttackFailed'),
        details: {
          missileCount: missileAttack.missileCount,
          missileHits: 0,
          missileIntercepted: 0,
          defenseLosses: {}
        },
        read: false
      } as MissionReport)
      return
    }

    // 计算导弹攻击结果
    const impactResult = missileLogic.calculateMissileImpact(missileAttack.missileCount, targetPlanet)

    // 应用损失到目标星球
    missileLogic.applyMissileAttackResult(targetPlanet, impactResult.defenseLosses)

    // 如果目标是NPC的星球，同步损失到NPC实际数据并扣除外交好感度
    if (targetPlanet.ownerId && targetPlanet.ownerId !== gameStore.player.id) {
      const targetNpc = npcStore.npcs.find(npc => npc.id === targetPlanet.ownerId)
      if (targetNpc) {
        const npcPlanet = targetNpc.planets.find(p => p.id === targetPlanet.id)
        if (npcPlanet) {
          missileLogic.applyMissileAttackResult(npcPlanet, impactResult.defenseLosses)
        }

        // 导弹攻击扣除好感度
        const { REPUTATION_CHANGES } = DIPLOMATIC_CONFIG
        const reputationLoss = REPUTATION_CHANGES.ATTACK / 2

        if (!targetNpc.relations) {
          targetNpc.relations = {}
        }
        const npcRelation = diplomaticLogic.getOrCreateRelation(targetNpc.relations, targetNpc.id, gameStore.player.id)
        targetNpc.relations[gameStore.player.id] = diplomaticLogic.updateReputation(
          npcRelation,
          reputationLoss,
          DiplomaticEventType.Attack,
          t('diplomacy.reports.wasAttackedByMissile')
        )
      }
    }

    // 标记导弹攻击为已到达
    missileAttack.status = 'arrived'

    // 生成导弹攻击报告
    const reportMessage =
      impactResult.missileHits > 0
        ? `${t('missionReports.missileAttackSuccess')}: ${impactResult.missileHits} ${t('missionReports.hits')}`
        : t('missionReports.missileAttackIntercepted')

    gameStore.player.missionReports.push({
      id: `missile-report-${missileAttack.id}`,
      timestamp: Date.now(),
      missionType: MissionType.MissileAttack,
      originPlanetId: missileAttack.originPlanetId,
      originPlanetName,
      targetPosition: missileAttack.targetPosition,
      targetPlanetId: targetPlanet.id,
      targetPlanetName: targetPlanet.name,
      success: true,
      message: reportMessage,
      details: {
        missileCount: missileAttack.missileCount,
        missileHits: impactResult.missileHits,
        missileIntercepted: impactResult.missileIntercepted,
        defenseLosses: impactResult.defenseLosses
      },
      read: false
    } as MissionReport)
  }

  /**
   * 查找玩家任务最早到达时间（快速，只遍历玩家数据）
   */
  const findPlayerEarliestArrival = (
    playerMissions: FleetMission[],
    missileAttacks: MissileAttack[]
  ): number => {
    let earliest = Number.MAX_SAFE_INTEGER

    for (const m of playerMissions) {
      if (m.status === 'outbound' && m.arrivalTime < earliest) {
        earliest = m.arrivalTime
      } else if (m.status === 'returning' && m.returnTime && m.returnTime < earliest) {
        earliest = m.returnTime
      }
    }

    for (const m of missileAttacks) {
      if (m.status === 'flying' && m.arrivalTime < earliest) {
        earliest = m.arrivalTime
      }
    }

    return earliest
  }

  /**
   * 计算 NPC 任务最早到达时间
   */
  const calcNpcMissionStats = (npcs: NPC[]): { earliest: number } => {
    let earliest = Number.MAX_SAFE_INTEGER

    for (const npc of npcs) {
      if (!npc.fleetMissions) continue
      for (const m of npc.fleetMissions) {
        if (m.status === 'outbound' && m.arrivalTime < earliest) {
          earliest = m.arrivalTime
        } else if (m.status === 'returning' && m.returnTime && m.returnTime < earliest) {
          earliest = m.returnTime
        }
      }
    }

    return { earliest }
  }

  /**
   * 获取 NPC 任务最早到达时间（带缓存）
   * 只在缓存过期时重新计算（避免每 tick 遍历 200+ NPC）
   */
  const getNpcEarliestArrival = (npcs: NPC[], now: number): number => {
    // 只有当缓存时间已过期时才重新计算
    // 这意味着新添加的 NPC 任务可能延迟最多 1 tick 被发现，但性能提升很大
    if (cachedNpcEarliestArrival <= now) {
      const stats = calcNpcMissionStats(npcs)
      cachedNpcEarliestArrival = stats.earliest
    }

    return cachedNpcEarliestArrival
  }

  /**
   * 主 tick 函数
   * 优化：使用缓存的 NPC 到达时间，避免每 tick 遍历 200+ NPC
   */
  const tick = async (ctx: TickContext) => {
    const { gameStore, npcStore, now, dirtyFlags } = ctx

    // 诊断计时
    const t0 = performance.now()

    const playerMissions = gameStore.player.fleetMissions
    const missileAttacks = gameStore.player.missileAttacks
    const npcs = npcStore.npcs

    const t1 = performance.now()

    // 快速计算玩家任务最早到达时间（通常只有几个任务）
    const playerEarliest = findPlayerEarliestArrival(playerMissions, missileAttacks)

    const t2 = performance.now()

    // 获取 NPC 任务最早到达时间（使用缓存，避免遍历 200+ NPC）
    const npcEarliest = getNpcEarliestArrival(npcs, now)

    const t3 = performance.now()

    // 计算全局最早到达时间
    const earliestArrival = Math.min(playerEarliest, npcEarliest)

    // 诊断日志：定位性能瓶颈
    const storeAccess = t1 - t0
    const playerCalc = t2 - t1
    const npcCalc = t3 - t2
    if (storeAccess > 5 || playerCalc > 5 || npcCalc > 5) {
      console.log('[MissionEngine] Timing breakdown:', {
        storeAccess: storeAccess.toFixed(2) + 'ms',
        playerCalc: playerCalc.toFixed(2) + 'ms',
        npcCalc: npcCalc.toFixed(2) + 'ms',
        earlyExit: earliestArrival > now
      })
    }

    // 如果还没到达时间点则跳过
    if (earliestArrival > now) {
      return
    }

    let missionProcessed = false

    // 处理玩家舰队任务（只处理到达时间 <= now 的）
    for (const mission of playerMissions) {
      // 处理到达（outbound -> 任务执行）
      if (mission.status === 'outbound' && now >= mission.arrivalTime) {
        await processPlayerMissionArrival(ctx, mission)
        missionProcessed = true
      }
      // 处理返回（returning -> 返回母星）
      else if (mission.status === 'returning' && mission.returnTime && now >= mission.returnTime) {
        processPlayerMissionReturn(ctx, mission)
        missionProcessed = true
      }
    }

    // 处理导弹攻击（反向循环以便安全删除）
    for (let i = missileAttacks.length - 1; i >= 0; i--) {
      const missileAttack = missileAttacks[i]
      if (missileAttack && missileAttack.status === 'flying' && now >= missileAttack.arrivalTime) {
        processMissileAttackArrival(ctx, missileAttack)
        missileAttacks.splice(i, 1)
        missionProcessed = true
      }
    }

    // 处理 NPC 舰队任务
    for (const npc of npcs) {
      if (!npc.fleetMissions || npc.fleetMissions.length === 0) continue

      for (const mission of npc.fleetMissions) {
        if (mission.status === 'outbound' && now >= mission.arrivalTime) {
          await processNPCMissionArrival(ctx, npc, mission)
          missionProcessed = true
        } else if (mission.status === 'returning' && mission.returnTime && now >= mission.returnTime) {
          processNPCMissionReturn(ctx, npc, mission)
          missionProcessed = true
        }
      }
    }

    // 如果有任务被处理，标记相关标志为脏（需要重新计算）
    if (missionProcessed) {
      markFleetDirty(dirtyFlags)
      markEconomyDirty(dirtyFlags) // 任务可能改变资源
      markNpcDirty(dirtyFlags) // 任务可能影响NPC状态
    }
  }

  return { tick }
}
