import type {
  AllyDefenseNotification,
  DebrisField,
  FleetMission,
  IncomingFleetAlert,
  JointAttackInvite,
  MissionReport,
  NPC,
  NPCActivityNotification,
  Planet,
  Player,
  Position,
  SpiedNotification,
  SpyReport
} from '@/types/game'
import { decryptData, encryptData } from './crypto'
import { generatePlanetTemperature } from '@/logic/planetLogic'
import pkg from '../../package.json'

/**
 * 数据迁移工具
 * 用于从旧版本数据结构迁移到新版本
 */

type PlanetKind = 'planet' | 'moon'

// oldPlanetId -> position -> planet/moon -> remapped target
type DuplicatePlanetIdMap = Map<
  string,
  Map<string, Map<PlanetKind, { newId: string; name: string }>>
>

interface MigratablePlayer extends Player {
  diplomaticRelations?: Record<string, unknown>
}

interface MigratableGameData {
  currentPlanetId?: string
  player?: MigratablePlayer
  npcs?: NPC[]
  universePlanets?: Record<string, Planet>
  debrisFields?: Record<string, DebrisField>
}

interface PlanetReferenceContext {
  position?: Position
  isMoon?: boolean
  planetName?: string
}

const getPlanetPositionKey = (position: Position): string => {
  return `${position.galaxy}:${position.system}:${position.position}`
}

const getPlanetKindKey = (isMoon?: boolean): PlanetKind => {
  return isMoon ? 'moon' : 'planet'
}

const buildDuplicatePlanetIdMap = (player: Player): DuplicatePlanetIdMap => {
  const planetsByOriginalId = new Map<string, Planet[]>()

  player.planets.forEach(planet => {
    let group = planetsByOriginalId.get(planet.id)
    if (!group) {
      group = []
      planetsByOriginalId.set(planet.id, group)
    }
    group.push(planet)
  })

  const idMap: DuplicatePlanetIdMap = new Map()

  planetsByOriginalId.forEach((planets, originalId) => {
    if (planets.length <= 1) return

    planets.forEach((planet, index) => {
      if (index === 0) return

      const newId = `${originalId}_${Math.random().toString(36).substring(2, 9)}`
      const positionKey = getPlanetPositionKey(planet.position)

      let byPosition = idMap.get(originalId)
      if (!byPosition) {
        byPosition = new Map()
        idMap.set(originalId, byPosition)
      }

      let byKind = byPosition.get(positionKey)
      if (!byKind) {
        byKind = new Map()
        byPosition.set(positionKey, byKind)
      }

      byKind.set(getPlanetKindKey(planet.isMoon), {
        newId,
        name: planet.name
      })

      planet.id = newId
    })
  })

  return idMap
}

const resolveRemappedPlanetId = (
  planetId: string | undefined,
  idMap: DuplicatePlanetIdMap,
  context: PlanetReferenceContext = {}
): string | undefined => {
  if (!planetId) return undefined

  const byPosition = idMap.get(planetId)
  if (!byPosition) return undefined

  if (context.position) {
    const byKind = byPosition.get(getPlanetPositionKey(context.position))
    if (!byKind) return undefined

    // 只有在位置或名称足够区分目标时才重写引用，避免把旧引用误指到错误星球
    if (context.isMoon !== undefined) {
      return byKind.get(getPlanetKindKey(context.isMoon))?.newId
    }

    if (context.planetName) {
      const matchedByName = Array.from(byKind.values()).filter(entry => entry.name === context.planetName)
      if (matchedByName.length === 1) {
        const [matchedEntry] = matchedByName
        if (matchedEntry) {
          return matchedEntry.newId
        }
      }
    }

    if (byKind.size === 1) {
      return Array.from(byKind.values())[0]?.newId
    }

    return undefined
  }

  if (context.planetName) {
    const matchedByName: Array<{ newId: string; name: string }> = []

    byPosition.forEach(byKind => {
      byKind.forEach(entry => {
        if (entry.name === context.planetName) {
          matchedByName.push(entry)
        }
      })
    })

    if (matchedByName.length === 1) {
      const [matchedEntry] = matchedByName
      if (matchedEntry) {
        return matchedEntry.newId
      }
    }
  }

  return undefined
}

const updatePlanetIdField = <
  T extends Record<string, unknown>,
  K extends keyof T
>(
  target: T,
  key: K,
  idMap: DuplicatePlanetIdMap,
  context: PlanetReferenceContext = {}
): boolean => {
  const currentValue = target[key]
  if (typeof currentValue !== 'string') return false

  const remappedPlanetId = resolveRemappedPlanetId(currentValue, idMap, context)
  if (!remappedPlanetId || remappedPlanetId === currentValue) return false

  target[key] = remappedPlanetId as T[K]
  return true
}

const updateMissionTargetPlanetId = (mission: FleetMission, idMap: DuplicatePlanetIdMap): boolean => {
  return updatePlanetIdField(mission as unknown as Record<string, unknown>, 'targetPlanetId', idMap, {
    position: mission.targetPosition,
    isMoon: mission.targetIsMoon
  })
}

const updateSpyReportTargetPlanetId = (report: SpyReport, idMap: DuplicatePlanetIdMap): boolean => {
  return updatePlanetIdField(report as unknown as Record<string, unknown>, 'targetPlanetId', idMap, {
    position: report.targetPosition,
    planetName: report.targetPlanetName
  })
}

const updateSpiedNotificationTargetPlanetId = (
  notification: SpiedNotification,
  idMap: DuplicatePlanetIdMap
): boolean => {
  return updatePlanetIdField(notification as unknown as Record<string, unknown>, 'targetPlanetId', idMap, {
    planetName: notification.targetPlanetName
  })
}

const updateNPCActivityTargetPlanetId = (
  notification: NPCActivityNotification,
  idMap: DuplicatePlanetIdMap
): boolean => {
  return updatePlanetIdField(notification as unknown as Record<string, unknown>, 'targetPlanetId', idMap, {
    position: notification.targetPosition,
    planetName: notification.targetPlanetName
  })
}

const updateIncomingAlertTargetPlanetId = (
  alert: IncomingFleetAlert,
  idMap: DuplicatePlanetIdMap
): boolean => {
  return updatePlanetIdField(alert as unknown as Record<string, unknown>, 'targetPlanetId', idMap, {
    planetName: alert.targetPlanetName
  })
}

const updateJointAttackTargetPlanetId = (
  invite: JointAttackInvite,
  idMap: DuplicatePlanetIdMap
): boolean => {
  return updatePlanetIdField(invite as unknown as Record<string, unknown>, 'targetPlanetId', idMap, {
    position: invite.targetPosition
  })
}

const updateAllyDefenseTargetPlanetId = (
  notification: AllyDefenseNotification,
  idMap: DuplicatePlanetIdMap
): boolean => {
  return updatePlanetIdField(notification as unknown as Record<string, unknown>, 'targetPlanetId', idMap, {
    planetName: notification.targetPlanetName
  })
}

const updateMissionReportPlanetIds = (report: MissionReport, idMap: DuplicatePlanetIdMap): boolean => {
  let mutated = false

  if (updatePlanetIdField(report as unknown as Record<string, unknown>, 'originPlanetId', idMap, {
    planetName: report.originPlanetName
  })) {
    mutated = true
  }

  if (updatePlanetIdField(report as unknown as Record<string, unknown>, 'targetPlanetId', idMap, {
    position: report.targetPosition,
    planetName: report.targetPlanetName
  })) {
    mutated = true
  }

  if (report.details?.newPlanetId) {
    const remappedNewPlanetId = resolveRemappedPlanetId(report.details.newPlanetId, idMap, {
      position: report.targetPosition,
      planetName: report.details.newPlanetName || report.targetPlanetName
    })

    if (remappedNewPlanetId && remappedNewPlanetId !== report.details.newPlanetId) {
      report.details.newPlanetId = remappedNewPlanetId
      mutated = true
    }
  }

  return mutated
}

/**
 * 修复玩家星球的重复ID，并同步更新可被可靠识别的旧引用。
 * 缺少位置或名称上下文、无法安全判定归属的旧引用会保留原ID，
 * 继续指向保留下来的首个星球，避免把数据误指到错误目标。
 */
const fixDuplicatePlanetIds = (data: MigratableGameData): boolean => {
  const player = data.player
  if (!player || !Array.isArray(player.planets) || player.planets.length === 0) {
    return false
  }

  const idMap = buildDuplicatePlanetIdMap(player)
  if (idMap.size === 0) {
    return false
  }

  // buildDuplicatePlanetIdMap 已经在上一步直接修复了重复星球 ID，
  // 只要 idMap 非空，就说明当前迁移已经发生了实际修改。
  let mutated = true

  player.planets.forEach(planet => {
    if (planet.isMoon && updatePlanetIdField(planet as unknown as Record<string, unknown>, 'parentPlanetId', idMap, {
      position: planet.position,
      isMoon: false
    })) {
      mutated = true
    }

    // 等待队列里的 planetId 应始终与所属星球保持一致
    planet.waitingBuildQueue?.forEach(item => {
      if (item.planetId && item.planetId !== planet.id) {
        item.planetId = planet.id
        mutated = true
      }
    })
  })

  if (updatePlanetIdField(data as unknown as Record<string, unknown>, 'currentPlanetId', idMap)) {
    mutated = true
  }

  player.fleetMissions?.forEach(mission => {
    if (updateMissionTargetPlanetId(mission, idMap)) {
      mutated = true
    }
  })

  player.spyReports?.forEach(report => {
    if (updateSpyReportTargetPlanetId(report, idMap)) {
      mutated = true
    }
  })

  player.spiedNotifications?.forEach(notification => {
    if (updateSpiedNotificationTargetPlanetId(notification, idMap)) {
      mutated = true
    }
  })

  player.npcActivityNotifications?.forEach(notification => {
    if (updateNPCActivityTargetPlanetId(notification, idMap)) {
      mutated = true
    }
  })

  player.missionReports?.forEach(report => {
    if (updateMissionReportPlanetIds(report, idMap)) {
      mutated = true
    }
  })

  player.incomingFleetAlerts?.forEach(alert => {
    if (updateIncomingAlertTargetPlanetId(alert, idMap)) {
      mutated = true
    }
  })

  player.jointAttackInvites?.forEach(invite => {
    if (updateJointAttackTargetPlanetId(invite, idMap)) {
      mutated = true
    }
  })

  player.allyDefenseNotifications?.forEach(notification => {
    if (updateAllyDefenseTargetPlanetId(notification, idMap)) {
      mutated = true
    }
  })

  data.npcs?.forEach(npc => {
    if (npc.playerSpyReports) {
      // playerSpyReports 的 key 就是玩家星球 ID，需要和报告内容一起迁移
      const remappedPlayerSpyReports: Record<string, SpyReport> = {}

      Object.entries(npc.playerSpyReports).forEach(([planetId, report]) => {
        if (updateSpyReportTargetPlanetId(report, idMap)) {
          mutated = true
        }

        const remappedPlanetId = resolveRemappedPlanetId(planetId, idMap, {
          position: report.targetPosition,
          planetName: report.targetPlanetName
        })

        if (remappedPlanetId && remappedPlanetId !== planetId) {
          remappedPlayerSpyReports[remappedPlanetId] = report
          mutated = true
        } else {
          remappedPlayerSpyReports[planetId] = report
        }
      })

      npc.playerSpyReports = remappedPlayerSpyReports
    }

    npc.fleetMissions?.forEach(mission => {
      if (updateMissionTargetPlanetId(mission, idMap)) {
        mutated = true
      }
    })
  })

  return mutated
}

/**
 * 执行数据迁移
 * 将旧版本的 universePlanets 和 debrisFields 从 gameStore 迁移到 universeStore
 */
export const migrateGameData = (): void => {
  try {
    const storageKey = pkg.name
    const universeStorageKey = `${pkg.name}-universe`

    // 读取旧的加密存档
    const oldEncryptedData = localStorage.getItem(storageKey)
    if (!oldEncryptedData) return

    // 尝试解密（如果是加密格式）
    let oldData: MigratableGameData
    try {
      oldData = decryptData(oldEncryptedData) as MigratableGameData
    } catch {
      // 解密失败，可能是新格式（未加密），直接解析
      try {
        oldData = JSON.parse(oldEncryptedData) as MigratableGameData
      } catch {
        return // 无法解析，放弃迁移
      }
    }

    // 标记是否有数据需要保存
    let needsSave = false

    // 修复NPC数据（确保所有必需字段都存在）
    if (oldData.npcs && Array.isArray(oldData.npcs)) {
      const now = Date.now()
      const playerId = oldData.player?.id

      oldData.npcs.forEach((npc: NPC) => {
        // 确保NPC有必需的时间字段，并设置随机冷却避免同时行动
        if (npc.lastSpyTime === undefined || npc.lastSpyTime === 0) {
          // 0-4分钟的随机延迟
          const randomSpyOffset = Math.random() * 240 * 1000
          npc.lastSpyTime = now - randomSpyOffset
          needsSave = true
        }
        if (npc.lastAttackTime === undefined || npc.lastAttackTime === 0) {
          // 0-8分钟的随机延迟
          const randomAttackOffset = Math.random() * 480 * 1000
          npc.lastAttackTime = now - randomAttackOffset
          needsSave = true
        }
        // 确保NPC有必需的数组字段
        if (!npc.fleetMissions) {
          npc.fleetMissions = []
          needsSave = true
        }
        if (!npc.playerSpyReports) {
          npc.playerSpyReports = {}
          needsSave = true
        }
        if (!npc.relations) {
          npc.relations = {}
          needsSave = true
        }
        if (!npc.allies) {
          npc.allies = []
          needsSave = true
        }
        if (!npc.enemies) {
          npc.enemies = []
          needsSave = true
        }

        // 如果NPC与玩家没有建立关系，自动建立中立关系
        if (playerId && !npc.relations[playerId]) {
          npc.relations[playerId] = {
            fromId: npc.id,
            toId: playerId,
            reputation: 0,
            status: 'neutral' as const,
            lastUpdated: now,
            history: []
          }
          needsSave = true
        }
      })
    }

    // 初始化玩家积分（如果不存在）
    if (oldData.player && oldData.player.points === undefined) {
      // 积分会在游戏启动时通过 initGame 计算，这里设置为0
      oldData.player.points = 0
      needsSave = true
    }

    // 修复重复的星球ID
    if (fixDuplicatePlanetIds(oldData)) {
      needsSave = true
    }

    // 迁移温度数据：为没有温度的星球生成温度
    // 玩家星球
    if (oldData.player?.planets && Array.isArray(oldData.player.planets)) {
      oldData.player.planets.forEach((planet: Planet) => {
        // 月球不需要温度
        if (!planet.isMoon && !planet.temperature) {
          planet.temperature = generatePlanetTemperature(planet.position.position)
          needsSave = true
        }
        // 迁移矿脉数据：确保所有矿脉都有 position 字段
        if (planet.oreDeposits && !planet.isMoon) {
          const deposits = planet.oreDeposits as any
          // 情况1：旧格式有 initialMetal，需要删除并添加 position
          if (deposits.initialMetal !== undefined) {
            delete deposits.initialMetal
            delete deposits.initialCrystal
            delete deposits.initialDeuterium
            needsSave = true
          }
          // 情况2：没有 position 字段，需要添加
          if (!deposits.position) {
            deposits.position = { ...planet.position }
            needsSave = true
          }
        }
      })
    }

    // NPC星球
    if (oldData.npcs && Array.isArray(oldData.npcs)) {
      oldData.npcs.forEach((npc: NPC) => {
        if (npc.planets && Array.isArray(npc.planets)) {
          npc.planets.forEach((planet: Planet) => {
            // 月球不需要温度
            if (!planet.isMoon && !planet.temperature) {
              planet.temperature = generatePlanetTemperature(planet.position.position)
              needsSave = true
            }
            // 迁移矿脉数据：确保所有矿脉都有 position 字段
            if (planet.oreDeposits && !planet.isMoon) {
              const deposits = planet.oreDeposits as any
              // 情况1：旧格式有 initialMetal，需要删除
              if (deposits.initialMetal !== undefined) {
                delete deposits.initialMetal
                delete deposits.initialCrystal
                delete deposits.initialDeuterium
                needsSave = true
              }
              // 情况2：没有 position 字段，需要添加
              if (!deposits.position) {
                deposits.position = { ...planet.position }
                needsSave = true
              }
            }
          })
        }
      })
    }

    // 迁移 player.diplomaticRelations 到 npc.relations
    // 旧版本使用 player.diplomaticRelations[npcId] 存储玩家对NPC的关系
    // 新版本统一使用 npc.relations[playerId] 存储NPC对玩家的关系
    if (oldData.player?.diplomaticRelations && oldData.npcs && Array.isArray(oldData.npcs)) {
      const playerId = oldData.player.id
      const npcs = oldData.npcs
      const playerRelations = oldData.player.diplomaticRelations as Record<string, any>

      Object.entries(playerRelations).forEach(([npcId, relation]) => {
        const npc = npcs.find((n: NPC) => n.id === npcId)
        if (npc) {
          if (!npc.relations) {
            npc.relations = {}
          }
          // 如果NPC对玩家的关系不存在，使用玩家对NPC的关系数据
          if (!npc.relations[playerId]) {
            npc.relations[playerId] = {
              ...relation,
              fromId: npcId,
              toId: playerId
            }
            needsSave = true
          } else {
            // 如果两边都有数据，使用声望值更极端的那个（偏离0更远的）
            const existingReputation = npc.relations[playerId].reputation || 0
            const playerReputation = relation.reputation || 0
            if (Math.abs(playerReputation) > Math.abs(existingReputation)) {
              npc.relations[playerId].reputation = playerReputation
              npc.relations[playerId].status = relation.status
              needsSave = true
            }
          }
        }
      })

      // 删除旧的 diplomaticRelations 字段
      delete oldData.player.diplomaticRelations
      needsSave = true
    }

    // 检查是否需要迁移地图数据
    const hasOldMapData = oldData.universePlanets || oldData.debrisFields

    if (hasOldMapData) {
      // 准备 universeStore 数据
      const universeData: {
        planets: Record<string, Planet>
        debrisFields: Record<string, DebrisField>
      } = {
        planets: {},
        debrisFields: {}
      }

      // 迁移星球数据（排除玩家星球）
      if (oldData.universePlanets) {
        const oldPlanets = oldData.universePlanets as Record<string, Planet>
        const playerPlanets = oldData.player?.planets || []
        const playerPlanetIds = new Set(playerPlanets.map((p: Planet) => p.id))
        Object.entries(oldPlanets).forEach(([key, planet]) => {
          // 只迁移非玩家星球
          if (!playerPlanetIds.has(planet.id)) {
            // 为没有温度的星球生成温度
            if (!planet.isMoon && !planet.temperature) {
              planet.temperature = generatePlanetTemperature(planet.position.position)
            }
            universeData.planets[key] = planet
          }
        })
        delete oldData.universePlanets
        needsSave = true
      }

      // 迁移残骸场数据
      if (oldData.debrisFields) {
        universeData.debrisFields = oldData.debrisFields
        delete oldData.debrisFields
        needsSave = true
      }

      // 保存universeStore数据
      localStorage.setItem(universeStorageKey, encryptData(universeData))
    }

    // 检查并更新已存在的 universeStore 数据中的星球温度
    const existingUniverseData = localStorage.getItem(universeStorageKey)
    if (existingUniverseData) {
      try {
        let universeData: { planets: Record<string, Planet>; debrisFields: Record<string, DebrisField> }
        try {
          universeData = decryptData(existingUniverseData)
        } catch {
          universeData = JSON.parse(existingUniverseData)
        }

        let universePlanetMigrated = false
        if (universeData.planets) {
          Object.values(universeData.planets).forEach((planet: Planet) => {
            if (!planet.isMoon && !planet.temperature) {
              planet.temperature = generatePlanetTemperature(planet.position.position)
              universePlanetMigrated = true
            }
          })
        }

        if (universePlanetMigrated) {
          localStorage.setItem(universeStorageKey, encryptData(universeData))
        }
      } catch (error) {
        console.error('[Migration] Failed to migrate universe planets temperature:', error)
      }
    }

    // 如果有任何数据被修改，保存gameStore数据
    if (needsSave) {
      localStorage.setItem(storageKey, encryptData(oldData))
    }
  } catch (error) {
    console.error('[Migration] Failed to migrate game data:', error)
  }
}
