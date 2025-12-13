import type { FleetMission, Planet, Resources, Fleet, BattleResult, SpyReport, Player, Officer, DebrisField } from '@/types/game'
import { ShipType, DefenseType, MissionType, BuildingType, OfficerType } from '@/types/game'
import { FLEET_STORAGE_CONFIG } from '@/config/gameConfig'
import * as battleLogic from './battleLogic'
import * as moonLogic from './moonLogic'
import * as moonValidation from './moonValidation'

/**
 * 计算两个星球之间的距离
 * 使用类似 OGame 的距离计算公式
 */
export const calculateDistance = (
  from: { galaxy: number; system: number; position: number },
  to: { galaxy: number; system: number; position: number }
): number => {
  // 同一位置
  if (from.galaxy === to.galaxy && from.system === to.system && from.position === to.position) {
    return 5
  }

  // 同星系内不同位置
  if (from.galaxy === to.galaxy && from.system === to.system) {
    return 1000 + Math.abs(to.position - from.position) * 5
  }

  // 同系统内不同星系
  if (from.galaxy === to.galaxy) {
    return 2700 + Math.abs(to.system - from.system) * 95
  }

  // 不同系统
  return 20000 + Math.abs(to.galaxy - from.galaxy) * 20000
}

/**
 * 计算飞行时间
 */
export const calculateFlightTime = (distance: number, minSpeed: number): number => {
  return Math.max(10, Math.floor((distance * 10000) / minSpeed)) // 至少10秒
}

/**
 * 创建舰队任务
 */
export const createFleetMission = (
  playerId: string,
  originPlanetId: string,
  targetPosition: { galaxy: number; system: number; position: number },
  missionType: MissionType,
  fleet: Partial<Fleet>,
  cargo: Resources,
  flightTime: number
): FleetMission => {
  const now = Date.now()
  return {
    id: `mission_${now}`,
    playerId,
    originPlanetId,
    targetPosition,
    missionType,
    fleet,
    cargo,
    departureTime: now,
    arrivalTime: now + flightTime * 1000,
    returnTime: now + flightTime * 2 * 1000,
    status: 'outbound'
  }
}

/**
 * 处理运输任务到达
 */
export const processTransportArrival = (mission: FleetMission, targetPlanet: Planet | undefined): void => {
  if (targetPlanet) {
    targetPlanet.resources.metal += mission.cargo.metal
    targetPlanet.resources.crystal += mission.cargo.crystal
    targetPlanet.resources.deuterium += mission.cargo.deuterium
    targetPlanet.resources.darkMatter += mission.cargo.darkMatter
  }
  mission.status = 'returning'
  mission.cargo = { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }
}

/**
 * 处理攻击任务到达
 */
export const processAttackArrival = async (
  mission: FleetMission,
  targetPlanet: Planet | undefined,
  attacker: Player,
  defender: Player | null,
  allPlanets: Planet[]
): Promise<{ battleResult: BattleResult; moon: Planet | null; debrisField: DebrisField | null } | null> => {
  if (!targetPlanet || targetPlanet.ownerId === attacker.id) {
    mission.status = 'returning'
    return null
  }

  // 执行战斗（使用 Worker 进行异步计算）
  const battleResult = await battleLogic.simulateBattle(
    mission.fleet,
    targetPlanet.fleet,
    targetPlanet.defense,
    targetPlanet.resources,
    attacker.officers,
    defender?.officers || ({} as Record<OfficerType, Officer>)
  )

  // 更新战斗报告ID
  battleResult.id = `battle_${Date.now()}`
  battleResult.attackerId = attacker.id
  battleResult.defenderId = targetPlanet.ownerId || 'unknown'
  battleResult.attackerPlanetId = mission.originPlanetId
  battleResult.defenderPlanetId = targetPlanet.id

  // 如果攻击方获胜，掠夺资源已经在战斗模拟中计算
  mission.cargo = battleResult.plunder

  // 更新舰队 - 计算幸存舰船
  const survivingFleet: Partial<Fleet> = {}
  Object.entries(mission.fleet).forEach(([shipType, initialCount]) => {
    const lost = battleResult.attackerLosses[shipType as ShipType] || 0
    const surviving = initialCount - lost
    if (surviving > 0) {
      survivingFleet[shipType as ShipType] = surviving
    }
  })
  mission.fleet = survivingFleet

  // 更新目标星球舰队和防御
  Object.entries(battleResult.defenderLosses.fleet).forEach(([shipType, lost]) => {
    targetPlanet.fleet[shipType as ShipType] = Math.max(0, targetPlanet.fleet[shipType as ShipType] - lost)
  })

  Object.entries(battleResult.defenderLosses.defense).forEach(([defenseType, lost]) => {
    targetPlanet.defense[defenseType as DefenseType] = Math.max(0, targetPlanet.defense[defenseType as DefenseType] - lost)
  })

  // 防御设施修复（70%概率）
  const defenseBeforeBattle: Partial<Record<DefenseType, number>> = { ...targetPlanet.defense }
  Object.entries(battleResult.defenderLosses.defense).forEach(([defenseType, lost]) => {
    defenseBeforeBattle[defenseType as DefenseType] = (defenseBeforeBattle[defenseType as DefenseType] || 0) + lost
  })
  targetPlanet.defense = battleLogic.repairDefense(defenseBeforeBattle, targetPlanet.defense) as Record<DefenseType, number>

  // 扣除掠夺的资源
  targetPlanet.resources.metal -= battleResult.plunder.metal
  targetPlanet.resources.crystal -= battleResult.plunder.crystal
  targetPlanet.resources.deuterium -= battleResult.plunder.deuterium

  mission.status = 'returning'

  // 尝试生成月球（如果该位置还没有月球）
  let moon: Planet | null = null
  const moonCheck = moonValidation.canCreateMoon(allPlanets, targetPlanet.position, battleResult.debrisField)
  if (moonCheck.canCreate && moonCheck.chance) {
    if (moonValidation.shouldGenerateMoon(moonCheck.chance)) {
      moon = moonLogic.tryGenerateMoon(battleResult.debrisField, targetPlanet.position, targetPlanet.id, targetPlanet.ownerId || 'unknown')
    }
  }

  // 创建残骸场（如果有残骸）
  let debrisField: DebrisField | null = null
  const totalDebris = battleResult.debrisField.metal + battleResult.debrisField.crystal
  if (totalDebris > 0) {
    debrisField = {
      id: `debris_${targetPlanet.position.galaxy}_${targetPlanet.position.system}_${targetPlanet.position.position}`,
      position: targetPlanet.position,
      resources: {
        metal: battleResult.debrisField.metal,
        crystal: battleResult.debrisField.crystal
      },
      createdAt: Date.now()
    }
  }

  return { battleResult, moon, debrisField }
}

/**
 * 处理殖民任务到达
 */
export const processColonizeArrival = (
  mission: FleetMission,
  targetPlanet: Planet | undefined,
  playerId: string,
  colonyNameTemplate: string = 'Colony'
): Planet | null => {
  if (targetPlanet) {
    // 位置已被占用
    mission.status = 'returning'
    return null
  }

  // 创建新殖民地
  const newPlanet: Planet = {
    id: `planet_${Date.now()}`,
    name: `${colonyNameTemplate} ${mission.targetPosition.galaxy}:${mission.targetPosition.system}:${mission.targetPosition.position}`,
    ownerId: playerId,
    position: mission.targetPosition,
    resources: { metal: 500, crystal: 500, deuterium: 0, darkMatter: 0, energy: 0 },
    buildings: {} as Record<BuildingType, number>,
    fleet: {
      [ShipType.LightFighter]: 0,
      [ShipType.HeavyFighter]: 0,
      [ShipType.Cruiser]: 0,
      [ShipType.Battleship]: 0,
      [ShipType.SmallCargo]: 0,
      [ShipType.LargeCargo]: 0,
      [ShipType.ColonyShip]: 0,
      [ShipType.Recycler]: 0,
      [ShipType.EspionageProbe]: 0,
      [ShipType.DarkMatterHarvester]: 0,
      [ShipType.Deathstar]: 0
    },
    defense: {
      [DefenseType.RocketLauncher]: 0,
      [DefenseType.LightLaser]: 0,
      [DefenseType.HeavyLaser]: 0,
      [DefenseType.GaussCannon]: 0,
      [DefenseType.IonCannon]: 0,
      [DefenseType.PlasmaTurret]: 0,
      [DefenseType.SmallShieldDome]: 0,
      [DefenseType.LargeShieldDome]: 0,
      [DefenseType.PlanetaryShield]: 0
    },
    buildQueue: [],
    lastUpdate: Date.now(),
    maxSpace: 200,
    maxFleetStorage: FLEET_STORAGE_CONFIG.baseStorage,
    isMoon: false
  }

  Object.values(BuildingType).forEach(building => {
    newPlanet.buildings[building] = 0
  })

  // 殖民船被消耗
  mission.fleet[ShipType.ColonyShip] = (mission.fleet[ShipType.ColonyShip] || 1) - 1
  mission.status = 'returning'

  return newPlanet
}

/**
 * 处理间谍任务到达
 */
export const processSpyArrival = (mission: FleetMission, targetPlanet: Planet | undefined, playerId: string): SpyReport | null => {
  if (!targetPlanet) {
    mission.status = 'returning'
    return null
  }

  const spyReport: SpyReport = {
    id: `spy_${Date.now()}`,
    timestamp: Date.now(),
    spyId: playerId,
    targetPlanetId: targetPlanet.id,
    targetPlayerId: targetPlanet.ownerId || 'unknown',
    resources: { ...targetPlanet.resources },
    fleet: { ...targetPlanet.fleet },
    defense: { ...targetPlanet.defense },
    buildings: { ...targetPlanet.buildings },
    technologies: {},
    detectionChance: 0.3
  }

  mission.status = 'returning'
  return spyReport
}

/**
 * 处理部署任务到达
 */
export const processDeployArrival = (mission: FleetMission, targetPlanet: Planet | undefined, playerId: string): boolean => {
  if (!targetPlanet || targetPlanet.ownerId !== playerId) {
    mission.status = 'returning'
    return false
  }

  for (const [shipType, count] of Object.entries(mission.fleet)) {
    targetPlanet.fleet[shipType as ShipType] += count
  }

  // 部署任务直接完成，不返回
  return true
}

/**
 * 处理回收任务到达
 */
export const processRecycleArrival = (
  mission: FleetMission,
  debrisField: DebrisField | undefined
): { collectedResources: Pick<Resources, 'metal' | 'crystal'>; remainingDebris: Pick<Resources, 'metal' | 'crystal'> | null } | null => {
  if (!debrisField) {
    mission.status = 'returning'
    return null
  }

  // 计算回收船的货舱容量
  const recyclerCount = mission.fleet[ShipType.Recycler] || 0
  const recyclerCapacity = 20000 // 每艘回收船容量20000
  const totalCapacity = recyclerCount * recyclerCapacity

  // 计算已装载的货物
  const currentCargo = mission.cargo.metal + mission.cargo.crystal + mission.cargo.deuterium

  // 剩余容量
  const availableCapacity = totalCapacity - currentCargo

  // 计算可以收集的资源
  const totalDebris = debrisField.resources.metal + debrisField.resources.crystal
  const collectedAmount = Math.min(totalDebris, availableCapacity)

  // 按比例收集金属和晶体
  const metalRatio = debrisField.resources.metal / totalDebris
  const crystalRatio = debrisField.resources.crystal / totalDebris

  const collectedMetal = Math.floor(collectedAmount * metalRatio)
  const collectedCrystal = Math.floor(collectedAmount * crystalRatio)

  // 更新任务货物
  mission.cargo.metal += collectedMetal
  mission.cargo.crystal += collectedCrystal

  // 更新残骸场
  const remainingMetal = debrisField.resources.metal - collectedMetal
  const remainingCrystal = debrisField.resources.crystal - collectedCrystal

  mission.status = 'returning'

  return {
    collectedResources: {
      metal: collectedMetal,
      crystal: collectedCrystal
    },
    remainingDebris:
      remainingMetal > 0 || remainingCrystal > 0
        ? {
            metal: remainingMetal,
            crystal: remainingCrystal
          }
        : null
  }
}

/**
 * 计算行星毁灭概率
 */
export const calculateDestructionChance = (
  deathstarCount: number,
  planetaryShieldCount: number,
  planetDefensePower: number
): number => {
  // 基础摧毁概率：每艘死星 10%
  let baseChance = deathstarCount * 10

  // 行星护盾减少概率：每个护盾 -5%
  const shieldReduction = planetaryShieldCount * 5

  // 防御力量减少概率：每 10000 防御力量 -1%
  const defensePowerReduction = Math.floor(planetDefensePower / 10000)

  // 最终概率
  let finalChance = baseChance - shieldReduction - defensePowerReduction

  // 限制在 1% - 99% 之间
  return Math.max(1, Math.min(99, finalChance))
}

/**
 * 计算星球总防御力量
 */
export const calculatePlanetDefensePower = (
  fleet: Partial<Fleet>,
  defense: Partial<Record<DefenseType, number>>
): number => {
  let totalPower = 0

  // 计算舰队力量
  Object.entries(fleet).forEach(([_shipType, count]) => {
    if (count > 0) {
      // 简单估算：每艘船的攻击力 + 护盾 + 装甲 / 10
      totalPower += count * 100 // 简化计算
    }
  })

  // 计算防御设施力量
  Object.entries(defense).forEach(([_defenseType, count]) => {
    if (count > 0) {
      totalPower += count * 50 // 简化计算
    }
  })

  return totalPower
}

/**
 * 处理行星毁灭任务到达
 */
export const processDestroyArrival = (
  mission: FleetMission,
  targetPlanet: Planet | undefined,
  attacker: Player
): { success: boolean; destructionChance: number; planetId?: string } | null => {
  if (!targetPlanet || targetPlanet.ownerId === attacker.id) {
    mission.status = 'returning'
    return null
  }

  // 检查是否有死星
  const deathstarCount = mission.fleet[ShipType.Deathstar] || 0
  if (deathstarCount === 0) {
    mission.status = 'returning'
    return null
  }

  // 计算目标星球的防御力量
  const planetaryShieldCount = targetPlanet.defense[DefenseType.PlanetaryShield] || 0
  const defensePower = calculatePlanetDefensePower(targetPlanet.fleet, targetPlanet.defense)

  // 计算摧毁概率
  const destructionChance = calculateDestructionChance(deathstarCount, planetaryShieldCount, defensePower)

  // 随机判断是否成功
  const randomValue = Math.random() * 100
  const success = randomValue < destructionChance

  mission.status = 'returning'

  return {
    success,
    destructionChance,
    planetId: success ? targetPlanet.id : undefined
  }
}

/**
 * 处理舰队任务返回
 */
export const processFleetReturn = (mission: FleetMission, originPlanet: Planet): void => {
  // 舰船返回
  Object.entries(mission.fleet).forEach(([shipType, count]) => {
    if (count > 0) {
      originPlanet.fleet[shipType as ShipType] += count
    }
  })

  // 资源返回（掠夺物或运输货物）
  originPlanet.resources.metal += mission.cargo.metal
  originPlanet.resources.crystal += mission.cargo.crystal
  originPlanet.resources.deuterium += mission.cargo.deuterium
  originPlanet.resources.darkMatter += mission.cargo.darkMatter
}

/**
 * 更新舰队任务状态
 */
export const updateFleetMissions = async (
  missions: FleetMission[],
  planets: Map<string, Planet>,
  debrisFields: Map<string, DebrisField>,
  attacker: Player,
  defender: Player | null,
  now: number
): Promise<{
  completedMissions: string[]
  battleReports: BattleResult[]
  spyReports: SpyReport[]
  newColonies: Planet[]
  newMoons: Planet[]
  newDebrisFields: DebrisField[]
  updatedDebrisFields: DebrisField[]
  removedDebrisFieldIds: string[]
  destroyedPlanetIds: string[]
}> => {
  const completedMissions: string[] = []
  const battleReports: BattleResult[] = []
  const spyReports: SpyReport[] = []
  const newColonies: Planet[] = []
  const newMoons: Planet[] = []
  const newDebrisFields: DebrisField[] = []
  const updatedDebrisFields: DebrisField[] = []
  const removedDebrisFieldIds: string[] = []
  const destroyedPlanetIds: string[] = []

  // 获取所有星球列表（用于月球生成检查）
  const allPlanets = Array.from(planets.values())

  // 使用 for...of 以支持 await
  for (const mission of missions) {
    const originPlanet = attacker.planets.find(p => p.id === mission.originPlanetId)

    if (mission.status === 'outbound' && now >= mission.arrivalTime) {
      // 任务到达目标
      const targetKey = `${mission.targetPosition.galaxy}:${mission.targetPosition.system}:${mission.targetPosition.position}`
      const targetPlanet = planets.get(targetKey)

      switch (mission.missionType) {
        case MissionType.Transport:
          processTransportArrival(mission, targetPlanet)
          break

        case MissionType.Attack: {
          const attackResult = await processAttackArrival(mission, targetPlanet, attacker, defender, allPlanets)
          if (attackResult) {
            battleReports.push(attackResult.battleResult)
            if (attackResult.moon) {
              newMoons.push(attackResult.moon)
              // 将月球添加到planets map中
              const moonKey = `${attackResult.moon.position.galaxy}:${attackResult.moon.position.system}:${attackResult.moon.position.position}`
              planets.set(moonKey, attackResult.moon)
            }
            if (attackResult.debrisField) {
              newDebrisFields.push(attackResult.debrisField)
            }
          }
          break
        }

        case MissionType.Colonize:
          const newColony = processColonizeArrival(mission, targetPlanet, attacker.id)
          if (newColony) {
            newColonies.push(newColony)
            planets.set(targetKey, newColony)
          }
          break

        case MissionType.Spy:
          const spyReport = processSpyArrival(mission, targetPlanet, attacker.id)
          if (spyReport) {
            spyReports.push(spyReport)
          }
          break

        case MissionType.Deploy:
          const deployed = processDeployArrival(mission, targetPlanet, attacker.id)
          if (deployed) {
            completedMissions.push(mission.id)
          }
          break

        case MissionType.Recycle:
          const debrisId = `debris_${mission.targetPosition.galaxy}_${mission.targetPosition.system}_${mission.targetPosition.position}`
          const debrisField = debrisFields.get(debrisId)
          const recycleResult = processRecycleArrival(mission, debrisField)
          if (recycleResult) {
            if (recycleResult.remainingDebris) {
              // 更新残骸场
              const updatedDebris: DebrisField = {
                ...debrisField!,
                resources: recycleResult.remainingDebris
              }
              debrisFields.set(debrisId, updatedDebris)
              updatedDebrisFields.push(updatedDebris)
            } else {
              // 残骸场已被完全收集，删除
              debrisFields.delete(debrisId)
              removedDebrisFieldIds.push(debrisId)
            }
          }
          break

        case MissionType.Destroy:
          const destroyResult = processDestroyArrival(mission, targetPlanet, attacker)
          if (destroyResult && destroyResult.success && destroyResult.planetId) {
            // 星球被摧毁
            destroyedPlanetIds.push(destroyResult.planetId)
            planets.delete(targetKey)
          }
          break
      }
    }

    if (mission.status === 'returning' && mission.returnTime && now >= mission.returnTime) {
      // 舰队返回
      if (originPlanet) {
        processFleetReturn(mission, originPlanet)
      }
      completedMissions.push(mission.id)
    }
  }

  return { completedMissions, battleReports, spyReports, newColonies, newMoons, newDebrisFields, updatedDebrisFields, removedDebrisFieldIds, destroyedPlanetIds }
}

/**
 * 召回舰队
 */
export const recallFleetMission = (mission: FleetMission, now: number): boolean => {
  if (mission.status !== 'outbound') return false

  const elapsedTime = now - mission.departureTime

  // 如果还在飞行途中，立即返回
  if (now < mission.arrivalTime) {
    mission.status = 'returning'
    mission.returnTime = now + elapsedTime // 返回时间等于已飞行的时间
    return true
  }

  return false
}
