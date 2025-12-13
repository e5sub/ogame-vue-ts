import type { Planet, DebrisField } from '@/types/game'
import { decryptData, encryptData } from './crypto'
import pkg from '../../package.json'

/**
 * 数据迁移工具
 * 用于从旧版本数据结构迁移到新版本
 */

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
    let oldData: any
    try {
      oldData = decryptData(oldEncryptedData)
    } catch {
      // 解密失败，可能是新格式（未加密），直接解析
      try {
        oldData = JSON.parse(oldEncryptedData)
      } catch {
        return // 无法解析，放弃迁移
      }
    }

    // 检查是否需要迁移
    const hasOldMapData = oldData.universePlanets || oldData.debrisFields
    if (!hasOldMapData) return

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
          universeData.planets[key] = planet
        }
      })
      delete oldData.universePlanets
    }

    // 迁移残骸场数据
    if (oldData.debrisFields) {
      universeData.debrisFields = oldData.debrisFields
      delete oldData.debrisFields
    }
    // 保存迁移后的数据
    localStorage.setItem(universeStorageKey, encryptData(universeData))
    localStorage.setItem(storageKey, encryptData(oldData))
  } catch (error) {
    console.error(error)
  }
}
