import type { Planet, Resources } from '@/types/game'
import { BuildingType } from '@/types/game'

/**
 * 计算电量产出
 */
export const calculateEnergyProduction = (
  planet: Planet,
  bonuses: {
    energyProductionBonus: number
  }
): number => {
  const solarPlantLevel = planet.buildings[BuildingType.SolarPlant] || 0
  const energyBonus = 1 + (bonuses.energyProductionBonus || 0) / 100

  // 太阳能电站每级产出：50 * 1.1^等级
  return solarPlantLevel * 50 * Math.pow(1.1, solarPlantLevel) * energyBonus
}

/**
 * 计算电量消耗
 */
export const calculateEnergyConsumption = (planet: Planet): number => {
  const metalMineLevel = planet.buildings[BuildingType.MetalMine] || 0
  const crystalMineLevel = planet.buildings[BuildingType.CrystalMine] || 0
  const deuteriumSynthesizerLevel = planet.buildings[BuildingType.DeuteriumSynthesizer] || 0

  // 矿场每级消耗：10 * 1.1^等级
  const metalConsumption = metalMineLevel * 10 * Math.pow(1.1, metalMineLevel)
  const crystalConsumption = crystalMineLevel * 10 * Math.pow(1.1, crystalMineLevel)
  const deuteriumConsumption = deuteriumSynthesizerLevel * 15 * Math.pow(1.1, deuteriumSynthesizerLevel)

  return metalConsumption + crystalConsumption + deuteriumConsumption
}

/**
 * 计算资源产量（每小时）
 */
export const calculateResourceProduction = (
  planet: Planet,
  bonuses: {
    resourceProductionBonus: number
    darkMatterProductionBonus: number
    energyProductionBonus: number
  }
): Resources => {
  const metalMineLevel = planet.buildings[BuildingType.MetalMine] || 0
  const crystalMineLevel = planet.buildings[BuildingType.CrystalMine] || 0
  const deuteriumSynthesizerLevel = planet.buildings[BuildingType.DeuteriumSynthesizer] || 0
  const darkMatterCollectorLevel = planet.buildings[BuildingType.DarkMatterCollector] || 0

  const resourceBonus = 1 + (bonuses.resourceProductionBonus || 0) / 100
  const darkMatterBonus = 1 + (bonuses.darkMatterProductionBonus || 0) / 100

  // 计算能量产出（每小时）
  const energyProduction = calculateEnergyProduction(planet, { energyProductionBonus: bonuses.energyProductionBonus })

  // 检查当前能量是否充足
  // 如果当前能量 <= 0，矿场停止生产
  const hasEnergy = planet.resources.energy > 0
  const productionEfficiency = hasEnergy ? 1 : 0

  return {
    metal: metalMineLevel * 1500 * Math.pow(1.5, metalMineLevel) * resourceBonus * productionEfficiency,
    crystal: crystalMineLevel * 1000 * Math.pow(1.5, crystalMineLevel) * resourceBonus * productionEfficiency,
    deuterium: deuteriumSynthesizerLevel * 500 * Math.pow(1.5, deuteriumSynthesizerLevel) * resourceBonus * productionEfficiency,
    darkMatter: darkMatterCollectorLevel * 25 * Math.pow(1.5, darkMatterCollectorLevel) * darkMatterBonus,
    energy: energyProduction
  }
}

/**
 * 计算资源容量
 */
export const calculateResourceCapacity = (planet: Planet, storageCapacityBonus: number): Resources => {
  const metalStorageLevel = planet.buildings[BuildingType.MetalStorage] || 0
  const crystalStorageLevel = planet.buildings[BuildingType.CrystalStorage] || 0
  const deuteriumTankLevel = planet.buildings[BuildingType.DeuteriumTank] || 0
  const darkMatterCollectorLevel = planet.buildings[BuildingType.DarkMatterCollector] || 0
  const solarPlantLevel = planet.buildings[BuildingType.SolarPlant] || 0

  const bonus = 1 + (storageCapacityBonus || 0) / 100

  const baseCapacity = 10000
  return {
    metal: baseCapacity * Math.pow(2, metalStorageLevel) * bonus,
    crystal: baseCapacity * Math.pow(2, crystalStorageLevel) * bonus,
    deuterium: baseCapacity * Math.pow(2, deuteriumTankLevel) * bonus,
    darkMatter: 1000 + darkMatterCollectorLevel * 100, // 暗物质容量较小
    energy: 1000 + solarPlantLevel * 500 // 能量容量基于太阳能电站等级
  }
}

/**
 * 更新星球资源
 */
export const updatePlanetResources = (
  planet: Planet,
  now: number,
  bonuses: {
    resourceProductionBonus: number
    darkMatterProductionBonus: number
    energyProductionBonus: number
    storageCapacityBonus: number
  }
): void => {
  const timeDiff = (now - planet.lastUpdate) / 1000 // 转换为秒

  // 计算能量消耗（每小时）
  const energyConsumption = calculateEnergyConsumption(planet)

  // 先增加能量产出
  const energyProduction = calculateEnergyProduction(planet, { energyProductionBonus: bonuses.energyProductionBonus })
  planet.resources.energy += (energyProduction * timeDiff) / 3600

  // 限制能量上限
  const capacity = calculateResourceCapacity(planet, bonuses.storageCapacityBonus)
  planet.resources.energy = Math.min(planet.resources.energy, capacity.energy)

  // 扣除能量消耗
  planet.resources.energy -= (energyConsumption * timeDiff) / 3600

  // 能量不能为负数，最低为0
  planet.resources.energy = Math.max(0, planet.resources.energy)

  // 计算资源产量（会检查能量是否充足）
  const production = calculateResourceProduction(planet, {
    resourceProductionBonus: bonuses.resourceProductionBonus,
    darkMatterProductionBonus: bonuses.darkMatterProductionBonus,
    energyProductionBonus: bonuses.energyProductionBonus
  })

  // 更新资源（转换为每秒产量）
  planet.resources.metal += (production.metal * timeDiff) / 3600
  planet.resources.crystal += (production.crystal * timeDiff) / 3600
  planet.resources.deuterium += (production.deuterium * timeDiff) / 3600
  planet.resources.darkMatter += (production.darkMatter * timeDiff) / 3600

  // 限制资源上限
  planet.resources.metal = Math.min(planet.resources.metal, capacity.metal)
  planet.resources.crystal = Math.min(planet.resources.crystal, capacity.crystal)
  planet.resources.deuterium = Math.min(planet.resources.deuterium, capacity.deuterium)
  planet.resources.darkMatter = Math.min(planet.resources.darkMatter, capacity.darkMatter)

  planet.lastUpdate = now
}

/**
 * 检查资源是否足够
 */
export const checkResourcesAvailable = (currentResources: Resources, cost: Resources): boolean => {
  return (
    currentResources.metal >= cost.metal &&
    currentResources.crystal >= cost.crystal &&
    currentResources.deuterium >= cost.deuterium &&
    currentResources.darkMatter >= cost.darkMatter
  )
}

/**
 * 扣除资源
 */
export const deductResources = (currentResources: Resources, cost: Resources): void => {
  currentResources.metal -= cost.metal
  currentResources.crystal -= cost.crystal
  currentResources.deuterium -= cost.deuterium
  currentResources.darkMatter -= cost.darkMatter
}

/**
 * 添加资源
 */
export const addResources = (currentResources: Resources, amount: Resources): void => {
  currentResources.metal += amount.metal
  currentResources.crystal += amount.crystal
  currentResources.deuterium += amount.deuterium
  currentResources.darkMatter += amount.darkMatter
}

/**
 * 资源产量详细信息（用于UI展示）
 */
export interface ProductionBreakdown {
  metal: ProductionDetail
  crystal: ProductionDetail
  deuterium: ProductionDetail
  darkMatter: ProductionDetail
  energy: ProductionDetail
}

export interface ProductionDetail {
  baseProduction: number // 建筑基础产量
  buildingLevel: number // 建筑等级
  buildingName: string // 建筑名称（用于显示）
  bonuses: ProductionBonus[] // 加成列表
  finalProduction: number // 最终产量
}

export interface ProductionBonus {
  name: string // 加成名称
  value: number // 加成百分比或固定值
  type: 'percentage' | 'multiplier' // 百分比加成或倍率
}

/**
 * 能量消耗详细信息
 */
export interface ConsumptionBreakdown {
  metalMine: ConsumptionDetail
  crystalMine: ConsumptionDetail
  deuteriumSynthesizer: ConsumptionDetail
  total: number
}

export interface ConsumptionDetail {
  buildingLevel: number
  buildingName: string
  consumption: number
}

/**
 * 计算资源产量详细breakdown
 */
export const calculateProductionBreakdown = (
  planet: Planet,
  bonuses: {
    resourceProductionBonus: number
    darkMatterProductionBonus: number
    energyProductionBonus: number
  }
): ProductionBreakdown => {
  const metalMineLevel = planet.buildings[BuildingType.MetalMine] || 0
  const crystalMineLevel = planet.buildings[BuildingType.CrystalMine] || 0
  const deuteriumSynthesizerLevel = planet.buildings[BuildingType.DeuteriumSynthesizer] || 0
  const darkMatterCollectorLevel = planet.buildings[BuildingType.DarkMatterCollector] || 0
  const solarPlantLevel = planet.buildings[BuildingType.SolarPlant] || 0

  const hasEnergy = planet.resources.energy > 0
  const productionEfficiency = hasEnergy ? 1 : 0

  // 金属矿产量
  const metalBase = metalMineLevel * 1500 * Math.pow(1.5, metalMineLevel)
  const metalBonuses: ProductionBonus[] = []
  if (bonuses.resourceProductionBonus > 0) {
    metalBonuses.push({
      name: 'officers.resourceBonus',
      value: bonuses.resourceProductionBonus,
      type: 'percentage'
    })
  }
  if (!hasEnergy) {
    metalBonuses.push({
      name: 'resources.noEnergy',
      value: -100,
      type: 'percentage'
    })
  }
  const metalFinal = metalBase * (1 + bonuses.resourceProductionBonus / 100) * productionEfficiency

  // 晶体矿产量
  const crystalBase = crystalMineLevel * 1000 * Math.pow(1.5, crystalMineLevel)
  const crystalBonuses: ProductionBonus[] = []
  if (bonuses.resourceProductionBonus > 0) {
    crystalBonuses.push({
      name: 'officers.resourceBonus',
      value: bonuses.resourceProductionBonus,
      type: 'percentage'
    })
  }
  if (!hasEnergy) {
    crystalBonuses.push({
      name: 'resources.noEnergy',
      value: -100,
      type: 'percentage'
    })
  }
  const crystalFinal = crystalBase * (1 + bonuses.resourceProductionBonus / 100) * productionEfficiency

  // 重氢合成器产量
  const deuteriumBase = deuteriumSynthesizerLevel * 500 * Math.pow(1.5, deuteriumSynthesizerLevel)
  const deuteriumBonuses: ProductionBonus[] = []
  if (bonuses.resourceProductionBonus > 0) {
    deuteriumBonuses.push({
      name: 'officers.resourceBonus',
      value: bonuses.resourceProductionBonus,
      type: 'percentage'
    })
  }
  if (!hasEnergy) {
    deuteriumBonuses.push({
      name: 'resources.noEnergy',
      value: -100,
      type: 'percentage'
    })
  }
  const deuteriumFinal = deuteriumBase * (1 + bonuses.resourceProductionBonus / 100) * productionEfficiency

  // 暗物质收集器产量
  const darkMatterBase = darkMatterCollectorLevel * 25 * Math.pow(1.5, darkMatterCollectorLevel)
  const darkMatterBonuses: ProductionBonus[] = []
  if (bonuses.darkMatterProductionBonus > 0) {
    darkMatterBonuses.push({
      name: 'officers.darkMatterBonus',
      value: bonuses.darkMatterProductionBonus,
      type: 'percentage'
    })
  }
  const darkMatterFinal = darkMatterBase * (1 + bonuses.darkMatterProductionBonus / 100)

  // 太阳能电站产量
  const energyBase = solarPlantLevel * 50 * Math.pow(1.1, solarPlantLevel)
  const energyBonuses: ProductionBonus[] = []
  if (bonuses.energyProductionBonus > 0) {
    energyBonuses.push({
      name: 'officers.energyBonus',
      value: bonuses.energyProductionBonus,
      type: 'percentage'
    })
  }
  const energyFinal = energyBase * (1 + bonuses.energyProductionBonus / 100)

  return {
    metal: {
      baseProduction: metalBase,
      buildingLevel: metalMineLevel,
      buildingName: 'buildings.metalMine',
      bonuses: metalBonuses,
      finalProduction: metalFinal
    },
    crystal: {
      baseProduction: crystalBase,
      buildingLevel: crystalMineLevel,
      buildingName: 'buildings.crystalMine',
      bonuses: crystalBonuses,
      finalProduction: crystalFinal
    },
    deuterium: {
      baseProduction: deuteriumBase,
      buildingLevel: deuteriumSynthesizerLevel,
      buildingName: 'buildings.deuteriumSynthesizer',
      bonuses: deuteriumBonuses,
      finalProduction: deuteriumFinal
    },
    darkMatter: {
      baseProduction: darkMatterBase,
      buildingLevel: darkMatterCollectorLevel,
      buildingName: 'buildings.darkMatterCollector',
      bonuses: darkMatterBonuses,
      finalProduction: darkMatterFinal
    },
    energy: {
      baseProduction: energyBase,
      buildingLevel: solarPlantLevel,
      buildingName: 'buildings.solarPlant',
      bonuses: energyBonuses,
      finalProduction: energyFinal
    }
  }
}

/**
 * 计算能量消耗详细breakdown
 */
export const calculateConsumptionBreakdown = (planet: Planet): ConsumptionBreakdown => {
  const metalMineLevel = planet.buildings[BuildingType.MetalMine] || 0
  const crystalMineLevel = planet.buildings[BuildingType.CrystalMine] || 0
  const deuteriumSynthesizerLevel = planet.buildings[BuildingType.DeuteriumSynthesizer] || 0

  const metalConsumption = metalMineLevel * 10 * Math.pow(1.1, metalMineLevel)
  const crystalConsumption = crystalMineLevel * 10 * Math.pow(1.1, crystalMineLevel)
  const deuteriumConsumption = deuteriumSynthesizerLevel * 15 * Math.pow(1.1, deuteriumSynthesizerLevel)

  return {
    metalMine: {
      buildingLevel: metalMineLevel,
      buildingName: 'buildings.metalMine',
      consumption: metalConsumption
    },
    crystalMine: {
      buildingLevel: crystalMineLevel,
      buildingName: 'buildings.crystalMine',
      consumption: crystalConsumption
    },
    deuteriumSynthesizer: {
      buildingLevel: deuteriumSynthesizerLevel,
      buildingName: 'buildings.deuteriumSynthesizer',
      consumption: deuteriumConsumption
    },
    total: metalConsumption + crystalConsumption + deuteriumConsumption
  }
}
