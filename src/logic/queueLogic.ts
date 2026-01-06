/**
 * 队列处理纯函数
 * 所有函数都是纯函数：无副作用，相同输入总是产生相同输出
 * 便于单元测试和服务端复用
 */

import type { BuildQueueItem, Fleet } from '@/types/game'
import { BuildingType, TechnologyType, ShipType, DefenseType } from '@/types/game'
import { BUILDINGS, TECHNOLOGIES, SHIPS, DEFENSES } from '@/config/gameConfig'

/**
 * 队列检查结果
 */
export interface QueueCheckResult {
  /** 已完成的项目 */
  completedItems: BuildQueueItem[]
  /** 剩余的队列项目 */
  remainingItems: BuildQueueItem[]
}

/**
 * 建筑完成结果
 */
export interface BuildingCompletionResult {
  /** 新的建筑等级 */
  newBuildings: Record<string, number>
  /** 完成的建筑列表 */
  completed: Array<{ type: BuildingType; level: number }>
}

/**
 * 研究完成结果
 */
export interface ResearchCompletionResult {
  /** 新的科技等级 */
  newTechnologies: Record<string, number>
  /** 完成的研究列表 */
  completed: Array<{ type: TechnologyType; level: number }>
}

/**
 * 船厂完成结果
 */
export interface ShipyardCompletionResult {
  /** 新的舰队 */
  newFleet: Partial<Fleet>
  /** 完成的船只列表 */
  completed: Array<{ type: ShipType; count: number }>
}

/**
 * 防御完成结果
 */
export interface DefenseCompletionResult {
  /** 新的防御设施 */
  newDefense: Partial<Record<DefenseType, number>>
  /** 完成的防御列表 */
  completed: Array<{ type: DefenseType; count: number }>
}

/**
 * 检查队列中已完成的项目（纯函数）
 * @pure
 */
export const checkQueueCompletion = (queue: BuildQueueItem[], now: number): QueueCheckResult => {
  const completedItems: BuildQueueItem[] = []
  const remainingItems: BuildQueueItem[] = []

  for (const item of queue) {
    if (item.endTime && item.endTime <= now) {
      completedItems.push(item)
    } else {
      remainingItems.push(item)
    }
  }

  return { completedItems, remainingItems }
}

/**
 * 应用建筑队列完成（纯函数）
 * @pure
 * @returns 新的建筑状态和完成列表
 */
export const applyBuildingCompletion = (
  currentBuildings: Record<string, number>,
  completedItems: BuildQueueItem[]
): BuildingCompletionResult => {
  const newBuildings = { ...currentBuildings }
  const completed: Array<{ type: BuildingType; level: number }> = []

  for (const item of completedItems) {
    // 检查 type 是 'building' 或 'demolish' 且 itemType 是 BuildingType
    if ((item.type === 'building' || item.type === 'demolish') && item.itemType in BuildingType) {
      const buildingType = item.itemType as BuildingType
      const currentLevel = newBuildings[buildingType] || 0

      if (item.type === 'demolish') {
        // 拆除：等级减1
        newBuildings[buildingType] = Math.max(0, currentLevel - 1)
      } else {
        // 建造：等级加1 或设置为目标等级
        newBuildings[buildingType] = item.targetLevel ?? currentLevel + 1
      }
      completed.push({ type: buildingType, level: newBuildings[buildingType] })
    }
  }

  return { newBuildings, completed }
}

/**
 * 应用研究队列完成（纯函数）
 * @pure
 * @returns 新的科技状态和完成列表
 */
export const applyResearchCompletion = (
  currentTechnologies: Record<string, number>,
  completedItems: BuildQueueItem[]
): ResearchCompletionResult => {
  const newTechnologies = { ...currentTechnologies }
  const completed: Array<{ type: TechnologyType; level: number }> = []

  for (const item of completedItems) {
    if (item.type === 'technology' && item.itemType in TechnologyType) {
      const techType = item.itemType as TechnologyType
      const currentLevel = newTechnologies[techType] || 0
      newTechnologies[techType] = item.targetLevel ?? currentLevel + 1
      completed.push({ type: techType, level: newTechnologies[techType] })
    }
  }

  return { newTechnologies, completed }
}

/**
 * 应用船厂队列完成（纯函数）
 * @pure
 * @returns 新的舰队状态和完成列表
 */
export const applyShipyardCompletion = (currentFleet: Partial<Fleet>, completedItems: BuildQueueItem[]): ShipyardCompletionResult => {
  const newFleet = { ...currentFleet }
  const completed: Array<{ type: ShipType; count: number }> = []

  for (const item of completedItems) {
    if (item.type === 'ship' && item.itemType in ShipType) {
      const shipType = item.itemType as ShipType
      const currentCount = newFleet[shipType] || 0
      const addCount = item.quantity || 1
      newFleet[shipType] = currentCount + addCount
      completed.push({ type: shipType, count: addCount })
    }
  }

  return { newFleet, completed }
}

/**
 * 应用防御队列完成（纯函数）
 * @pure
 * @returns 新的防御状态和完成列表
 */
export const applyDefenseCompletion = (
  currentDefense: Partial<Record<DefenseType, number>>,
  completedItems: BuildQueueItem[]
): DefenseCompletionResult => {
  const newDefense = { ...currentDefense }
  const completed: Array<{ type: DefenseType; count: number }> = []

  for (const item of completedItems) {
    if (item.type === 'defense' && item.itemType in DefenseType) {
      const defenseType = item.itemType as DefenseType
      const currentCount = newDefense[defenseType] || 0
      const addCount = item.quantity || 1
      newDefense[defenseType] = currentCount + addCount
      completed.push({ type: defenseType, count: addCount })
    }
  }

  return { newDefense, completed }
}

/**
 * 计算建筑建造时间（纯函数）
 * @pure
 */
export const calcBuildingTime = (
  buildingType: BuildingType,
  level: number,
  roboticsFactoryLevel: number = 0,
  naniteFactoryLevel: number = 0,
  gameSpeed: number = 1
): number => {
  const config = BUILDINGS[buildingType]
  if (!config) return 0

  const baseCost = config.baseCost
  const metalCost = baseCost.metal * Math.pow(config.costMultiplier, level - 1)
  const crystalCost = baseCost.crystal * Math.pow(config.costMultiplier, level - 1)

  // 基础建造时间（秒）
  const baseTime = ((metalCost + crystalCost) / 2500) * 3600

  // 机器人工厂加成
  const roboticsBonus = 1 + roboticsFactoryLevel

  // 纳米机器人工厂加成
  const naniteBonus = Math.pow(2, naniteFactoryLevel)

  // 最终时间
  return Math.max(1, Math.floor(baseTime / (roboticsBonus * naniteBonus * gameSpeed)))
}

/**
 * 计算研究时间（纯函数）
 * @pure
 */
export const calcResearchTime = (techType: TechnologyType, level: number, researchLabLevel: number = 0, gameSpeed: number = 1): number => {
  const config = TECHNOLOGIES[techType]
  if (!config) return 0

  const baseCost = config.baseCost
  const metalCost = baseCost.metal * Math.pow(config.costMultiplier, level - 1)
  const crystalCost = baseCost.crystal * Math.pow(config.costMultiplier, level - 1)

  // 基础研究时间（秒）
  const baseTime = ((metalCost + crystalCost) / 1000) * 3600

  // 研究实验室加成
  const labBonus = 1 + researchLabLevel

  // 最终时间
  return Math.max(1, Math.floor(baseTime / (labBonus * gameSpeed)))
}

/**
 * 计算船只建造时间（纯函数）
 * @pure
 */
export const calcShipBuildTime = (
  shipType: ShipType,
  count: number,
  shipyardLevel: number = 0,
  naniteFactoryLevel: number = 0,
  gameSpeed: number = 1
): number => {
  const config = SHIPS[shipType]
  if (!config) return 0

  const { metal, crystal } = config.cost

  // 单艘船基础建造时间（秒）
  const baseTime = ((metal + crystal) / 2500) * 3600

  // 船厂加成
  const shipyardBonus = 1 + shipyardLevel

  // 纳米机器人工厂加成
  const naniteBonus = Math.pow(2, naniteFactoryLevel)

  // 单艘船最终时间
  const singleShipTime = Math.max(1, Math.floor(baseTime / (shipyardBonus * naniteBonus * gameSpeed)))

  return singleShipTime * count
}

/**
 * 计算防御建造时间（纯函数）
 * @pure
 */
export const calcDefenseBuildTime = (
  defenseType: DefenseType,
  count: number,
  shipyardLevel: number = 0,
  naniteFactoryLevel: number = 0,
  gameSpeed: number = 1
): number => {
  const config = DEFENSES[defenseType]
  if (!config) return 0

  const { metal, crystal } = config.cost

  // 单个防御基础建造时间（秒）
  const baseTime = ((metal + crystal) / 2500) * 3600

  // 船厂加成
  const shipyardBonus = 1 + shipyardLevel

  // 纳米机器人工厂加成
  const naniteBonus = Math.pow(2, naniteFactoryLevel)

  // 单个防御最终时间
  const singleDefenseTime = Math.max(1, Math.floor(baseTime / (shipyardBonus * naniteBonus * gameSpeed)))

  return singleDefenseTime * count
}

/**
 * 检查是否可以开始下一个队列项（纯函数）
 * @pure
 */
export const canStartNextQueueItem = (queue: BuildQueueItem[], now: number): boolean => {
  if (queue.length === 0) return false

  const firstItem = queue[0]
  if (!firstItem) return false

  // 如果第一个项目还没有开始时间，可以开始
  if (!firstItem.startTime) return true
  // 如果第一个项目已经完成，可以开始下一个
  if (firstItem.endTime && firstItem.endTime <= now) return true

  return false
}

/**
 * 计算队列总剩余时间（纯函数）
 * @pure
 */
export const calcQueueRemainingTime = (queue: BuildQueueItem[], now: number): number => {
  if (queue.length === 0) return 0

  let totalTime = 0
  for (const item of queue) {
    if (item.endTime) {
      const remaining = Math.max(0, item.endTime - now)
      totalTime += remaining
    }
  }

  return totalTime
}
