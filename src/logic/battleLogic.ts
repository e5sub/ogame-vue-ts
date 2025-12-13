import type { Fleet, Resources, BattleResult, Officer } from '@/types/game'
import { DefenseType, OfficerType } from '@/types/game'
import * as officerLogic from './officerLogic'
import { workerManager } from '@/workers/workerManager'

/**
 * 执行战斗模拟
 * 使用 Web Worker 在后台线程中执行计算密集型的战斗模拟
 */
export const simulateBattle = async (
  attackerFleet: Partial<Fleet>,
  defenderFleet: Partial<Fleet>,
  defenderDefense: Partial<Record<DefenseType, number>>,
  defenderResources: Resources,
  attackerOfficers: Record<OfficerType, Officer>,
  defenderOfficers: Record<OfficerType, Officer>
): Promise<BattleResult> => {
  // 计算军官加成
  const attackerBonuses = officerLogic.calculateActiveBonuses(attackerOfficers, Date.now())
  const defenderBonuses = officerLogic.calculateActiveBonuses(defenderOfficers, Date.now())

  // 将防御加成转换为科技等级（简化：10%加成 = 1级科技）
  const attackerTechLevel = Math.floor(attackerBonuses.defenseBonus / 10)
  const defenderTechLevel = Math.floor(defenderBonuses.defenseBonus / 10)

  // 使用 Worker 执行战斗模拟
  const simulationResult = await workerManager.simulateBattle({
    attacker: {
      ships: attackerFleet,
      weaponTech: 0, // 暂时不考虑武器科技
      shieldTech: attackerTechLevel,
      armorTech: attackerTechLevel
    },
    defender: {
      ships: defenderFleet,
      defense: defenderDefense,
      weaponTech: 0,
      shieldTech: defenderTechLevel,
      armorTech: defenderTechLevel
    },
    maxRounds: 6 // 最多6回合
  })

  // 计算掠夺（仅攻击方胜利时）
  const plunder =
    simulationResult.winner === 'attacker'
      ? await workerManager.calculatePlunder({
          defenderResources,
          attackerFleet: simulationResult.attackerRemaining
        })
      : { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }

  // 计算残骸场
  const debrisField = await workerManager.calculateDebris({
    attackerLosses: simulationResult.attackerLosses,
    defenderLosses: simulationResult.defenderLosses
  })

  // 计算月球生成概率（根据残骸场总量）
  const totalDebris = debrisField.metal + debrisField.crystal
  const moonChance = Math.min(totalDebris / 100000, 0.2) // 最高20%概率

  // 生成战斗报告
  const battleResult: BattleResult = {
    id: `battle_${Date.now()}`,
    timestamp: Date.now(),
    attackerId: '',
    defenderId: '',
    attackerPlanetId: '',
    defenderPlanetId: '',
    attackerFleet,
    defenderFleet,
    defenderDefense,
    attackerLosses: simulationResult.attackerLosses,
    defenderLosses: simulationResult.defenderLosses,
    winner: simulationResult.winner,
    plunder,
    debrisField,
    // 新增详细信息
    rounds: simulationResult.rounds,
    attackerRemaining: simulationResult.attackerRemaining,
    defenderRemaining: simulationResult.defenderRemaining,
    roundDetails: simulationResult.roundDetails,
    moonChance
  }

  return battleResult
}

/**
 * 计算防御设施修复（防御有70%概率修复）
 */
export const repairDefense = (
  defenseBeforeBattle: Partial<Record<DefenseType, number>>,
  defenseAfterBattle: Partial<Record<DefenseType, number>>
): Partial<Record<DefenseType, number>> => {
  const repaired: Partial<Record<DefenseType, number>> = { ...defenseAfterBattle }

  Object.keys(defenseBeforeBattle).forEach(defenseType => {
    const before = defenseBeforeBattle[defenseType as DefenseType] || 0
    const after = defenseAfterBattle[defenseType as DefenseType] || 0
    const lost = before - after

    if (lost > 0) {
      // 70%修复概率
      const repairedCount = Math.floor(lost * 0.7)
      repaired[defenseType as DefenseType] = after + repairedCount
    }
  })

  return repaired
}
