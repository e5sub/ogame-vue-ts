/**
 * 生产计算纯函数
 * 所有函数都是纯函数：无副作用，相同输入总是产生相同输出
 * 便于单元测试和服务端复用
 */

import type { Planet, Resources } from '@/types/game'
import { BuildingType } from '@/types/game'

/**
 * 生产加成配置
 */
export interface ProductionBonuses {
  /** 能量生产加成百分比 */
  energyProductionBonus: number
  /** 存储容量加成百分比 */
  storageCapacityBonus: number
  /** 资源速度倍率 */
  resourceSpeed: number
}

/**
 * 科技加成配置
 */
export interface TechBonuses {
  /** 金属采矿研究等级 */
  mineralResearchLevel: number
  /** 晶体采矿研究等级 */
  crystalResearchLevel: number
  /** 燃料研究等级 */
  fuelResearchLevel: number
}

/**
 * 生产计算结果
 */
export interface ProductionResult {
  /** 资源生产量（每秒） */
  production: Resources
  /** 能量生产量 */
  energyProduction: number
  /** 能量消耗量 */
  energyConsumption: number
  /** 能量比率（0-1） */
  energyRatio: number
  /** 存储容量 */
  capacity: Resources
}

// 基础配置常量
const BASE_ENERGY_PRODUCTION = 0
const BASE_METAL_PRODUCTION = 10
const BASE_CRYSTAL_PRODUCTION = 5
const BASE_DEUTERIUM_PRODUCTION = 0
const BASE_STORAGE_CAPACITY = 10000
const STORAGE_CAPACITY_FACTOR = 2
const RESEARCH_PRODUCTION_BONUS_PER_LEVEL = 0.02

// 能量生产配置
const SOLAR_PLANT_BASE = 50
const SOLAR_PLANT_FACTOR = 1.1
const FUSION_REACTOR_BASE = 150
const FUSION_REACTOR_FACTOR = 1.15

// 能量消耗配置
const METAL_MINE_ENERGY_BASE = 10
const METAL_MINE_ENERGY_FACTOR = 1.1
const CRYSTAL_MINE_ENERGY_BASE = 10
const CRYSTAL_MINE_ENERGY_FACTOR = 1.1
const DEUTERIUM_SYNTH_ENERGY_BASE = 15
const DEUTERIUM_SYNTH_ENERGY_FACTOR = 1.1

// 资源生产配置（每小时）
const METAL_MINE_PRODUCTION_BASE = 30
const METAL_MINE_PRODUCTION_FACTOR = 1.1
const CRYSTAL_MINE_PRODUCTION_BASE = 20
const CRYSTAL_MINE_PRODUCTION_FACTOR = 1.1
const DEUTERIUM_SYNTH_PRODUCTION_BASE = 10
const DEUTERIUM_SYNTH_PRODUCTION_FACTOR = 1.1

// 核聚变反应堆重氢消耗
const FUSION_DEUTERIUM_BASE = 10
const FUSION_DEUTERIUM_FACTOR = 1.1

/**
 * 计算科技生产加成
 * @pure
 */
export const calcTechProductionBonus = (
  mineralResearchLevel: number = 0,
  crystalResearchLevel: number = 0,
  fuelResearchLevel: number = 0
): { metalBonus: number; crystalBonus: number; deuteriumBonus: number } => {
  return {
    metalBonus: mineralResearchLevel * RESEARCH_PRODUCTION_BONUS_PER_LEVEL,
    crystalBonus: crystalResearchLevel * RESEARCH_PRODUCTION_BONUS_PER_LEVEL,
    deuteriumBonus: fuelResearchLevel * RESEARCH_PRODUCTION_BONUS_PER_LEVEL
  }
}

/**
 * 计算能量生产（纯函数）
 * @pure
 */
export const calcEnergyProduction = (planet: Planet, energyProductionBonus: number = 0): number => {
  let totalEnergy = BASE_ENERGY_PRODUCTION

  // 太阳能电站
  const solarPlantLevel = planet.buildings[BuildingType.SolarPlant] || 0
  if (solarPlantLevel > 0) {
    totalEnergy += Math.floor(SOLAR_PLANT_BASE * solarPlantLevel * Math.pow(SOLAR_PLANT_FACTOR, solarPlantLevel))
  }

  // 核聚变反应堆
  const fusionReactorLevel = planet.buildings[BuildingType.FusionReactor] || 0
  if (fusionReactorLevel > 0) {
    totalEnergy += Math.floor(FUSION_REACTOR_BASE * fusionReactorLevel * Math.pow(FUSION_REACTOR_FACTOR, fusionReactorLevel))
  }

  // 应用加成
  return Math.floor(totalEnergy * (1 + energyProductionBonus))
}

/**
 * 计算能量消耗（纯函数）
 * @pure
 */
export const calcEnergyConsumption = (planet: Planet): number => {
  let totalConsumption = 0

  // 金属矿
  const metalMineLevel = planet.buildings[BuildingType.MetalMine] || 0
  if (metalMineLevel > 0) {
    totalConsumption += Math.floor(METAL_MINE_ENERGY_BASE * metalMineLevel * Math.pow(METAL_MINE_ENERGY_FACTOR, metalMineLevel))
  }

  // 晶体矿
  const crystalMineLevel = planet.buildings[BuildingType.CrystalMine] || 0
  if (crystalMineLevel > 0) {
    totalConsumption += Math.floor(CRYSTAL_MINE_ENERGY_BASE * crystalMineLevel * Math.pow(CRYSTAL_MINE_ENERGY_FACTOR, crystalMineLevel))
  }

  // 重氢合成器
  const deuteriumSynthesizerLevel = planet.buildings[BuildingType.DeuteriumSynthesizer] || 0
  if (deuteriumSynthesizerLevel > 0) {
    totalConsumption += Math.floor(
      DEUTERIUM_SYNTH_ENERGY_BASE * deuteriumSynthesizerLevel * Math.pow(DEUTERIUM_SYNTH_ENERGY_FACTOR, deuteriumSynthesizerLevel)
    )
  }

  return totalConsumption
}

/**
 * 计算资源生产量（纯函数）
 * @pure
 * @param planet 星球状态
 * @param energyRatio 能量比率（0-1）
 * @param techBonuses 科技加成
 * @returns 每秒资源生产量
 */
export const calcResourceProduction = (planet: Planet, energyRatio: number, techBonuses?: TechBonuses): Resources => {
  const effectiveRatio = Math.min(1, Math.max(0, energyRatio))
  const bonuses = techBonuses
    ? calcTechProductionBonus(techBonuses.mineralResearchLevel, techBonuses.crystalResearchLevel, techBonuses.fuelResearchLevel)
    : { metalBonus: 0, crystalBonus: 0, deuteriumBonus: 0 }

  // 金属生产
  let metalProduction = BASE_METAL_PRODUCTION
  const metalMineLevel = planet.buildings[BuildingType.MetalMine] || 0
  if (metalMineLevel > 0) {
    metalProduction += Math.floor(
      METAL_MINE_PRODUCTION_BASE * metalMineLevel * Math.pow(METAL_MINE_PRODUCTION_FACTOR, metalMineLevel) * effectiveRatio
    )
  }
  metalProduction = Math.floor(metalProduction * (1 + bonuses.metalBonus))

  // 晶体生产
  let crystalProduction = BASE_CRYSTAL_PRODUCTION
  const crystalMineLevel = planet.buildings[BuildingType.CrystalMine] || 0
  if (crystalMineLevel > 0) {
    crystalProduction += Math.floor(
      CRYSTAL_MINE_PRODUCTION_BASE * crystalMineLevel * Math.pow(CRYSTAL_MINE_PRODUCTION_FACTOR, crystalMineLevel) * effectiveRatio
    )
  }
  crystalProduction = Math.floor(crystalProduction * (1 + bonuses.crystalBonus))

  // 重氢生产
  let deuteriumProduction = BASE_DEUTERIUM_PRODUCTION
  const deuteriumSynthesizerLevel = planet.buildings[BuildingType.DeuteriumSynthesizer] || 0
  if (deuteriumSynthesizerLevel > 0) {
    // 重氢生产受温度影响
    const tempModifier = planet.temperature ? 1.28 - 0.002 * planet.temperature.max : 1
    deuteriumProduction += Math.floor(
      DEUTERIUM_SYNTH_PRODUCTION_BASE *
        deuteriumSynthesizerLevel *
        Math.pow(DEUTERIUM_SYNTH_PRODUCTION_FACTOR, deuteriumSynthesizerLevel) *
        effectiveRatio *
        tempModifier
    )
  }

  // 核聚变反应堆消耗重氢
  const fusionReactorLevel = planet.buildings[BuildingType.FusionReactor] || 0
  if (fusionReactorLevel > 0) {
    deuteriumProduction -= Math.floor(FUSION_DEUTERIUM_BASE * fusionReactorLevel * Math.pow(FUSION_DEUTERIUM_FACTOR, fusionReactorLevel))
  }

  deuteriumProduction = Math.floor(deuteriumProduction * (1 + bonuses.deuteriumBonus))

  return {
    metal: metalProduction,
    crystal: crystalProduction,
    deuterium: deuteriumProduction,
    darkMatter: 0,
    energy: 0
  }
}

/**
 * 计算存储容量（纯函数）
 * @pure
 */
export const calcStorageCapacity = (planet: Planet, storageCapacityBonus: number = 0): Resources => {
  const baseCapacity = BASE_STORAGE_CAPACITY
  const bonusMultiplier = 1 + storageCapacityBonus

  // 金属仓库
  const metalStorageLevel = planet.buildings[BuildingType.MetalStorage] || 0
  const metalCapacity = Math.floor(baseCapacity * Math.pow(STORAGE_CAPACITY_FACTOR, metalStorageLevel) * bonusMultiplier)

  // 晶体仓库
  const crystalStorageLevel = planet.buildings[BuildingType.CrystalStorage] || 0
  const crystalCapacity = Math.floor(baseCapacity * Math.pow(STORAGE_CAPACITY_FACTOR, crystalStorageLevel) * bonusMultiplier)

  // 重氢储罐
  const deuteriumTankLevel = planet.buildings[BuildingType.DeuteriumTank] || 0
  const deuteriumCapacity = Math.floor(baseCapacity * Math.pow(STORAGE_CAPACITY_FACTOR, deuteriumTankLevel) * bonusMultiplier)

  return {
    metal: metalCapacity,
    crystal: crystalCapacity,
    deuterium: deuteriumCapacity,
    darkMatter: Number.MAX_SAFE_INTEGER,
    energy: 0
  }
}

/**
 * 计算完整的生产数据（纯函数）
 * 这是主要的入口函数，聚合所有生产计算
 * @pure
 */
export const calcProduction = (planet: Planet, bonuses: ProductionBonuses, techBonuses?: TechBonuses): ProductionResult => {
  const energyProduction = calcEnergyProduction(planet, bonuses.energyProductionBonus)
  const energyConsumption = calcEnergyConsumption(planet)
  const energyRatio = energyConsumption > 0 ? Math.min(1, energyProduction / energyConsumption) : 1
  const capacity = calcStorageCapacity(planet, bonuses.storageCapacityBonus)

  // 计算每秒生产量
  const productionPerSecond = calcResourceProduction(planet, energyRatio, techBonuses)

  // 应用资源速度倍率
  const production: Resources = {
    metal: Math.floor(productionPerSecond.metal * bonuses.resourceSpeed),
    crystal: Math.floor(productionPerSecond.crystal * bonuses.resourceSpeed),
    deuterium: Math.floor(productionPerSecond.deuterium * bonuses.resourceSpeed),
    darkMatter: 0,
    energy: 0
  }

  return {
    production,
    energyProduction,
    energyConsumption,
    energyRatio,
    capacity
  }
}

/**
 * 计算时间段内的资源生产（纯函数）
 * @pure
 * @param planet 星球
 * @param deltaMs 时间间隔（毫秒）
 * @param bonuses 加成配置
 * @param techBonuses 科技加成
 * @returns 时间段内生产的资源量
 */
export const calcProductionForPeriod = (
  planet: Planet,
  deltaMs: number,
  bonuses: ProductionBonuses,
  techBonuses?: TechBonuses
): Resources => {
  const productionData = calcProduction(planet, bonuses, techBonuses)
  const seconds = deltaMs / 1000

  return {
    metal: Math.floor(productionData.production.metal * seconds),
    crystal: Math.floor(productionData.production.crystal * seconds),
    deuterium: Math.floor(productionData.production.deuterium * seconds),
    darkMatter: 0,
    energy: 0
  }
}

/**
 * 应用资源生产到星球（纯函数，返回新的资源状态）
 * @pure
 * @param currentResources 当前资源
 * @param produced 生产的资源
 * @param capacity 存储容量
 * @returns 新的资源状态和溢出量
 */
export const applyProduction = (
  currentResources: Resources,
  produced: Resources,
  capacity: Resources
): { newResources: Resources; overflow: Resources } => {
  const newMetal = currentResources.metal + produced.metal
  const newCrystal = currentResources.crystal + produced.crystal
  const newDeuterium = currentResources.deuterium + produced.deuterium

  const clampedMetal = Math.min(newMetal, capacity.metal)
  const clampedCrystal = Math.min(newCrystal, capacity.crystal)
  const clampedDeuterium = Math.min(newDeuterium, capacity.deuterium)

  return {
    newResources: {
      metal: clampedMetal,
      crystal: clampedCrystal,
      deuterium: clampedDeuterium,
      darkMatter: currentResources.darkMatter + produced.darkMatter,
      energy: currentResources.energy
    },
    overflow: {
      metal: Math.max(0, newMetal - capacity.metal),
      crystal: Math.max(0, newCrystal - capacity.crystal),
      deuterium: Math.max(0, newDeuterium - capacity.deuterium),
      darkMatter: 0,
      energy: 0
    }
  }
}
