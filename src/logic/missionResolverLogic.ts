/**
 * 任务解析纯函数
 * 所有函数都是纯函数：无副作用，相同输入总是产生相同输出
 * 便于单元测试和服务端复用
 */

import type { FleetMission, Resources, Fleet, Position, ExpeditionZone } from '@/types/game'
import { MissionType, ShipType } from '@/types/game'
import { SHIPS } from '@/config/gameConfig'

/**
 * 任务状态
 */
export type MissionStatus = 'outbound' | 'returning' | 'arrived' | 'completed'

/**
 * 任务解析结果
 */
export interface MissionResolution {
  /** 新的任务状态 */
  newStatus: MissionStatus
  /** 是否应该处理到达逻辑 */
  shouldProcessArrival: boolean
  /** 是否应该处理返回逻辑 */
  shouldProcessReturn: boolean
  /** 是否任务已完成（可以移除） */
  isCompleted: boolean
}

/**
 * 飞行时间计算结果
 */
export interface FlightTimeResult {
  /** 飞行时间（毫秒） */
  flightTimeMs: number
  /** 到达时间戳 */
  arrivalTime: number
  /** 返回时间戳（往返任务） */
  returnTime?: number
}

/**
 * 掠夺计算结果
 */
export interface PlunderResult {
  /** 可掠夺的资源 */
  plunderedResources: Resources
  /** 实际装载的资源（受运载能力限制） */
  loadedResources: Resources
  /** 剩余资源 */
  remainingResources: Resources
}

/**
 * 货舱容量计算结果
 */
export interface CargoCapacityResult {
  /** 总货舱容量 */
  totalCapacity: number
  /** 已使用容量 */
  usedCapacity: number
  /** 剩余容量 */
  remainingCapacity: number
}

/**
 * 解析任务当前状态（纯函数）
 * 根据当前时间判断任务应该处于什么状态
 * @pure
 */
export const resolveMission = (mission: FleetMission, now: number): MissionResolution => {
  const { status, arrivalTime, returnTime } = mission

  // 出发中 -> 检查是否到达
  if (status === 'outbound') {
    if (now >= arrivalTime) {
      return {
        newStatus: 'returning',
        shouldProcessArrival: true,
        shouldProcessReturn: false,
        isCompleted: false
      }
    }
    return {
      newStatus: 'outbound',
      shouldProcessArrival: false,
      shouldProcessReturn: false,
      isCompleted: false
    }
  }

  // 返回中 -> 检查是否返回母星
  if (status === 'returning') {
    if (returnTime && now >= returnTime) {
      return {
        newStatus: 'completed',
        shouldProcessArrival: false,
        shouldProcessReturn: true,
        isCompleted: true
      }
    }
    return {
      newStatus: 'returning',
      shouldProcessArrival: false,
      shouldProcessReturn: false,
      isCompleted: false
    }
  }

  // 已完成
  return {
    newStatus: 'completed',
    shouldProcessArrival: false,
    shouldProcessReturn: false,
    isCompleted: true
  }
}

/**
 * 计算两点间距离（纯函数）
 * @pure
 */
export const calcDistance = (from: Position, to: Position): number => {
  // 同一星球
  if (from.galaxy === to.galaxy && from.system === to.system && from.position === to.position) {
    return 5
  }

  // 同一星系
  if (from.galaxy === to.galaxy && from.system === to.system) {
    return 1000 + 5 * Math.abs(from.position - to.position)
  }

  // 同一银河
  if (from.galaxy === to.galaxy) {
    return 2700 + 95 * Math.abs(from.system - to.system)
  }

  // 不同银河
  return 20000 * Math.abs(from.galaxy - to.galaxy)
}

/**
 * 计算舰队最慢速度（纯函数）
 * @pure
 */
export const calcFleetMinSpeed = (fleet: Partial<Fleet>): number => {
  let minSpeed = Number.MAX_SAFE_INTEGER

  for (const [shipType, count] of Object.entries(fleet)) {
    if (count && count > 0) {
      const config = SHIPS[shipType as ShipType]
      if (config && config.speed < minSpeed) {
        minSpeed = config.speed
      }
    }
  }

  return minSpeed === Number.MAX_SAFE_INTEGER ? 0 : minSpeed
}

/**
 * 计算飞行时间（纯函数）
 * @pure
 */
export const calcFlightTime = (from: Position, to: Position, fleet: Partial<Fleet>, speedMultiplier: number = 1): number => {
  const distance = calcDistance(from, to)
  const minSpeed = calcFleetMinSpeed(fleet)

  if (minSpeed === 0) return 0

  // 飞行时间公式：(10 + 35000 / speedMultiplier * sqrt(distance * 10 / minSpeed))
  const baseTime = 10 + (35000 / speedMultiplier) * Math.sqrt((distance * 10) / minSpeed)

  return Math.round(baseTime)
}

/**
 * 计算完整飞行时间结果（纯函数）
 * @pure
 */
export const calcFlightTimeResult = (
  from: Position,
  to: Position,
  fleet: Partial<Fleet>,
  departureTime: number,
  speedMultiplier: number = 1,
  isOneWay: boolean = false
): FlightTimeResult => {
  const flightTimeSeconds = calcFlightTime(from, to, fleet, speedMultiplier)
  const flightTimeMs = flightTimeSeconds * 1000
  const arrivalTime = departureTime + flightTimeMs

  return {
    flightTimeMs,
    arrivalTime,
    returnTime: isOneWay ? undefined : arrivalTime + flightTimeMs
  }
}

/**
 * 计算舰队货舱容量（纯函数）
 * @pure
 */
export const calcCargoCapacity = (fleet: Partial<Fleet>, currentCargo?: Resources): CargoCapacityResult => {
  let totalCapacity = 0

  for (const [shipType, count] of Object.entries(fleet)) {
    if (count && count > 0) {
      const config = SHIPS[shipType as ShipType]
      if (config) {
        totalCapacity += config.cargoCapacity * count
      }
    }
  }

  const usedCapacity = currentCargo ? currentCargo.metal + currentCargo.crystal + currentCargo.deuterium + currentCargo.darkMatter : 0

  return {
    totalCapacity,
    usedCapacity,
    remainingCapacity: Math.max(0, totalCapacity - usedCapacity)
  }
}

/**
 * 计算掠夺资源（纯函数）
 * @pure
 */
export const calcPlunder = (defenderResources: Resources, attackerFleet: Partial<Fleet>, plunderRatio: number = 0.5): PlunderResult => {
  const { totalCapacity } = calcCargoCapacity(attackerFleet)

  // 可掠夺的资源（防守方资源的一定比例）
  const availableMetal = Math.floor(defenderResources.metal * plunderRatio)
  const availableCrystal = Math.floor(defenderResources.crystal * plunderRatio)
  const availableDeuterium = Math.floor(defenderResources.deuterium * plunderRatio)
  const availableDarkMatter = Math.floor(defenderResources.darkMatter * plunderRatio)

  const totalAvailable = availableMetal + availableCrystal + availableDeuterium + availableDarkMatter

  // 如果货舱容量足够，全部装载
  if (totalCapacity >= totalAvailable) {
    const plunderedResources: Resources = {
      metal: availableMetal,
      crystal: availableCrystal,
      deuterium: availableDeuterium,
      darkMatter: availableDarkMatter,
      energy: 0
    }

    return {
      plunderedResources,
      loadedResources: { ...plunderedResources },
      remainingResources: {
        metal: defenderResources.metal - availableMetal,
        crystal: defenderResources.crystal - availableCrystal,
        deuterium: defenderResources.deuterium - availableDeuterium,
        darkMatter: defenderResources.darkMatter - availableDarkMatter,
        energy: defenderResources.energy
      }
    }
  }

  // 按比例分配货舱容量
  const ratio = totalCapacity / totalAvailable
  const loadedMetal = Math.floor(availableMetal * ratio)
  const loadedCrystal = Math.floor(availableCrystal * ratio)
  const loadedDeuterium = Math.floor(availableDeuterium * ratio)
  const loadedDarkMatter = Math.floor(availableDarkMatter * ratio)

  return {
    plunderedResources: {
      metal: availableMetal,
      crystal: availableCrystal,
      deuterium: availableDeuterium,
      darkMatter: availableDarkMatter,
      energy: 0
    },
    loadedResources: {
      metal: loadedMetal,
      crystal: loadedCrystal,
      deuterium: loadedDeuterium,
      darkMatter: loadedDarkMatter,
      energy: 0
    },
    remainingResources: {
      metal: defenderResources.metal - loadedMetal,
      crystal: defenderResources.crystal - loadedCrystal,
      deuterium: defenderResources.deuterium - loadedDeuterium,
      darkMatter: defenderResources.darkMatter - loadedDarkMatter,
      energy: defenderResources.energy
    }
  }
}

/**
 * 计算燃料消耗（纯函数）
 * @pure
 */
export const calcFuelConsumption = (fleet: Partial<Fleet>, distance: number, holdTime: number = 0): number => {
  let totalConsumption = 0

  for (const [shipType, count] of Object.entries(fleet)) {
    if (count && count > 0) {
      const config = SHIPS[shipType as ShipType]
      if (config) {
        // 基础燃料消耗
        const baseFuel = config.fuelConsumption || 0
        // 距离因子
        const distanceFactor = 1 + distance / 35000
        // 单艘船消耗
        const shipFuel = Math.ceil(baseFuel * distanceFactor * count)
        totalConsumption += shipFuel
      }
    }
  }

  // 驻留时间额外消耗
  if (holdTime > 0) {
    totalConsumption += Math.ceil(totalConsumption * holdTime * 0.1)
  }

  return totalConsumption
}

/**
 * 检查是否可以执行任务（纯函数）
 * @pure
 */
export const canExecuteMission = (
  missionType: MissionType,
  fleet: Partial<Fleet>,
  resources: Resources,
  fuelRequired: number
): { canExecute: boolean; reason?: string } => {
  // 检查舰队是否为空
  const totalShips = Object.values(fleet).reduce((sum, count) => sum + (count || 0), 0)
  if (totalShips === 0) {
    return { canExecute: false, reason: 'noShips' }
  }

  // 检查燃料是否足够
  if (resources.deuterium < fuelRequired) {
    return { canExecute: false, reason: 'insufficientFuel' }
  }

  // 殖民任务需要殖民船
  if (missionType === MissionType.Colonize) {
    const colonyShipCount = fleet[ShipType.ColonyShip] ?? 0
    if (colonyShipCount < 1) {
      return { canExecute: false, reason: 'noColonyShip' }
    }
  }

  // 侦查任务需要探测器
  if (missionType === MissionType.Spy) {
    const probeCount = fleet[ShipType.EspionageProbe] ?? 0
    if (probeCount < 1) {
      return { canExecute: false, reason: 'noSpyProbe' }
    }
  }

  // 回收任务需要回收船
  if (missionType === MissionType.Recycle) {
    const recyclerCount = fleet[ShipType.Recycler] ?? 0
    if (recyclerCount < 1) {
      return { canExecute: false, reason: 'noRecycler' }
    }
  }

  return { canExecute: true }
}

/**
 * 创建任务对象（纯函数）
 * @pure
 */
export const createMission = (
  playerId: string,
  originPlanetId: string,
  targetPosition: Position,
  missionType: MissionType,
  fleet: Partial<Fleet>,
  cargo: Resources,
  departureTime: number,
  flightTimeMs: number,
  options?: {
    targetPlanetId?: string
    targetIsMoon?: boolean
    isGift?: boolean
    giftTargetNpcId?: string
    expeditionZone?: ExpeditionZone
  }
): FleetMission => {
  const arrivalTime = departureTime + flightTimeMs
  const returnTime = arrivalTime + flightTimeMs

  return {
    id: `mission-${departureTime}-${Math.random().toString(36).substr(2, 9)}`,
    playerId,
    originPlanetId,
    targetPosition,
    targetPlanetId: options?.targetPlanetId,
    targetIsMoon: options?.targetIsMoon,
    missionType,
    fleet: { ...fleet },
    cargo: { ...cargo },
    departureTime,
    arrivalTime,
    returnTime,
    status: 'outbound',
    isGift: options?.isGift,
    giftTargetNpcId: options?.giftTargetNpcId,
    expeditionZone: options?.expeditionZone
  }
}

/**
 * 计算任务剩余时间（纯函数）
 * @pure
 */
export const calcMissionRemainingTime = (mission: FleetMission, now: number): number => {
  if (mission.status === 'outbound') {
    return Math.max(0, mission.arrivalTime - now)
  }
  if (mission.status === 'returning' && mission.returnTime) {
    return Math.max(0, mission.returnTime - now)
  }
  return 0
}

/**
 * 计算召回任务的新返回时间（纯函数）
 * @pure
 */
export const calcRecallReturnTime = (mission: FleetMission, now: number): number => {
  if (mission.status !== 'outbound') {
    return mission.returnTime || now
  }

  // 计算已经飞行的时间
  const flownTime = now - mission.departureTime
  // 返回时间 = 当前时间 + 已飞行时间
  return now + flownTime
}
