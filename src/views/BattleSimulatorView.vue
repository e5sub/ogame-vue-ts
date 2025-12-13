<template>
  <div class="container mx-auto p-4 sm:p-6 space-y-6">
    <h1 class="text-2xl sm:text-3xl font-bold">{{ t('simulatorView.title') }}</h1>
    <!-- 标签切换 -->
    <div class="flex gap-2 border-b">
      <Button @click="activeTab = 'attacker'" :variant="activeTab === 'attacker' ? 'default' : 'ghost'" class="rounded-b-none">
        <Sword />
        {{ t('simulatorView.attacker') }}
      </Button>
      <Button @click="activeTab = 'defender'" :variant="activeTab === 'defender' ? 'default' : 'ghost'" class="rounded-b-none">
        <Shield />
        {{ t('simulatorView.defender') }}
      </Button>
    </div>
    <!-- 攻击方配置 -->
    <Card v-if="activeTab === 'attacker'">
      <CardHeader>
        <CardTitle>{{ t('simulatorView.attackerConfig') }}</CardTitle>
        <CardDescription>{{ t('simulatorView.attackerConfigDesc') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- 舰队配置 -->
        <div>
          <h3 class="text-sm font-medium mb-3">{{ t('simulatorView.fleet') }}</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div v-for="shipType in Object.values(ShipType)" :key="shipType" class="space-y-1">
              <Label :for="`attacker-${shipType}`" class="text-xs">{{ SHIPS[shipType].name }}</Label>
              <Input :id="`attacker-${shipType}`" v-model.number="attackerFleet[shipType]" type="number" min="0" class="h-8" />
            </div>
          </div>
        </div>
        <!-- 科技等级 -->
        <div>
          <h3 class="text-sm font-medium mb-3">{{ t('simulatorView.techLevels') }}</h3>
          <div class="grid grid-cols-3 gap-3">
            <div class="space-y-1">
              <Label for="attacker-weapon" class="text-xs">{{ t('simulatorView.weapon') }}</Label>
              <Input id="attacker-weapon" v-model.number="attackerTech.weapon" type="number" min="0" class="h-8" />
            </div>
            <div class="space-y-1">
              <Label for="attacker-shield" class="text-xs">{{ t('simulatorView.shield') }}</Label>
              <Input id="attacker-shield" v-model.number="attackerTech.shield" type="number" min="0" class="h-8" />
            </div>
            <div class="space-y-1">
              <Label for="attacker-armor" class="text-xs">{{ t('simulatorView.armor') }}</Label>
              <Input id="attacker-armor" v-model.number="attackerTech.armor" type="number" min="0" class="h-8" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    <!-- 防守方配置 -->
    <Card v-else>
      <CardHeader>
        <CardTitle>{{ t('simulatorView.defenderConfig') }}</CardTitle>
        <CardDescription>{{ t('simulatorView.defenderConfigDesc') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- 舰队配置 -->
        <div>
          <h3 class="text-sm font-medium mb-3">{{ t('simulatorView.fleet') }}</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div v-for="shipType in Object.values(ShipType)" :key="shipType" class="space-y-1">
              <Label :for="`defender-${shipType}`" class="text-xs">{{ SHIPS[shipType].name }}</Label>
              <Input :id="`defender-${shipType}`" v-model.number="defenderFleet[shipType]" type="number" min="0" class="h-8" />
            </div>
          </div>
        </div>

        <!-- 防御设施 -->
        <div>
          <h3 class="text-sm font-medium mb-3">{{ t('simulatorView.defenseStructures') }}</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div v-for="defenseType in Object.values(DefenseType)" :key="defenseType" class="space-y-1">
              <Label :for="`defense-${defenseType}`" class="text-xs">{{ DEFENSES[defenseType].name }}</Label>
              <Input :id="`defense-${defenseType}`" v-model.number="defenderDefense[defenseType]" type="number" min="0" class="h-8" />
            </div>
          </div>
        </div>

        <!-- 科技等级 -->
        <div>
          <h3 class="text-sm font-medium mb-3">{{ t('simulatorView.techLevels') }}</h3>
          <div class="grid grid-cols-3 gap-3">
            <div class="space-y-1">
              <Label for="defender-weapon" class="text-xs">{{ t('simulatorView.weapon') }}</Label>
              <Input id="defender-weapon" v-model.number="defenderTech.weapon" type="number" min="0" class="h-8" />
            </div>
            <div class="space-y-1">
              <Label for="defender-shield" class="text-xs">{{ t('simulatorView.shield') }}</Label>
              <Input id="defender-shield" v-model.number="defenderTech.shield" type="number" min="0" class="h-8" />
            </div>
            <div class="space-y-1">
              <Label for="defender-armor" class="text-xs">{{ t('simulatorView.armor') }}</Label>
              <Input id="defender-armor" v-model.number="defenderTech.armor" type="number" min="0" class="h-8" />
            </div>
          </div>
        </div>

        <!-- 防守方资源 -->
        <div>
          <h3 class="text-sm font-medium mb-3">{{ t('simulatorView.defenderResources') }}</h3>
          <div class="grid grid-cols-3 gap-3">
            <div class="space-y-1">
              <Label for="defender-metal" class="text-xs flex items-center gap-1">
                <ResourceIcon type="metal" size="sm" />
                {{ t('resources.metal') }}
              </Label>
              <Input id="defender-metal" v-model.number="defenderResources.metal" type="number" min="0" class="h-8" />
            </div>
            <div class="space-y-1">
              <Label for="defender-crystal" class="text-xs flex items-center gap-1">
                <ResourceIcon type="crystal" size="sm" />
                {{ t('resources.crystal') }}
              </Label>
              <Input id="defender-crystal" v-model.number="defenderResources.crystal" type="number" min="0" class="h-8" />
            </div>
            <div class="space-y-1">
              <Label for="defender-deuterium" class="text-xs flex items-center gap-1">
                <ResourceIcon type="deuterium" size="sm" />
                {{ t('resources.deuterium') }}
              </Label>
              <Input id="defender-deuterium" v-model.number="defenderResources.deuterium" type="number" min="0" class="h-8" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 操作按钮 -->
    <div class="flex gap-2">
      <Button @click="runSimulation" class="flex-1" size="lg">
        <Zap class="h-4 w-4 mr-2" />
        {{ t('simulatorView.startSimulation') }}
      </Button>
      <Button @click="resetSimulation" variant="outline" size="lg">
        <RotateCcw class="h-4 w-4 mr-2" />
        {{ t('simulatorView.reset') }}
      </Button>
    </div>

    <!-- 战斗结果对话框 -->
    <BattleReportDialog v-model:open="showResultDialog" :report="simulationResult" />
  </div>
</template>

<script setup lang="ts">
  import { ref, toRaw } from 'vue'
  import { useI18n } from '@/composables/useI18n'
  import { useGameConfig } from '@/composables/useGameConfig'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { ShipType, DefenseType } from '@/types/game'
  import type { Fleet, BattleResult } from '@/types/game'
  import { workerManager } from '@/workers/workerManager'
  import ResourceIcon from '@/components/ResourceIcon.vue'
  import BattleReportDialog from '@/components/BattleReportDialog.vue'
  import { Sword, Shield, Zap, RotateCcw } from 'lucide-vue-next'
  import * as planetLogic from '@/logic/planetLogic'

  const { t } = useI18n()
  const { SHIPS, DEFENSES } = useGameConfig()

  // 攻击方配置
  const attackerFleet = ref<Partial<Fleet>>({
    [ShipType.LightFighter]: 0,
    [ShipType.HeavyFighter]: 0,
    [ShipType.Cruiser]: 0,
    [ShipType.Battleship]: 0,
    [ShipType.SmallCargo]: 0,
    [ShipType.LargeCargo]: 0,
    [ShipType.ColonyShip]: 0,
    [ShipType.Recycler]: 0,
    [ShipType.EspionageProbe]: 0,
    [ShipType.DarkMatterHarvester]: 0
  })

  const activeTab = ref('attacker')

  const attackerTech = ref({
    weapon: 0,
    shield: 0,
    armor: 0
  })

  // 防守方配置
  const defenderFleet = ref<Partial<Fleet>>({
    [ShipType.LightFighter]: 0,
    [ShipType.HeavyFighter]: 0,
    [ShipType.Cruiser]: 0,
    [ShipType.Battleship]: 0,
    [ShipType.SmallCargo]: 0,
    [ShipType.LargeCargo]: 0,
    [ShipType.ColonyShip]: 0,
    [ShipType.Recycler]: 0,
    [ShipType.EspionageProbe]: 0,
    [ShipType.DarkMatterHarvester]: 0
  })

  const defenderDefense = ref<Partial<Record<DefenseType, number>>>({
    [DefenseType.RocketLauncher]: 0,
    [DefenseType.LightLaser]: 0,
    [DefenseType.HeavyLaser]: 0,
    [DefenseType.GaussCannon]: 0,
    [DefenseType.IonCannon]: 0,
    [DefenseType.PlasmaTurret]: 0,
    [DefenseType.SmallShieldDome]: 0,
    [DefenseType.LargeShieldDome]: 0
  })

  const defenderTech = ref({
    weapon: 0,
    shield: 0,
    armor: 0
  })

  const defenderResources = ref({
    metal: 100000,
    crystal: 50000,
    deuterium: 25000,
    darkMatter: 100,
    energy: 0
  })

  // 模拟结果
  const simulationResult = ref<BattleResult | null>(null)
  const showResultDialog = ref<boolean>(false)

  // 运行模拟（使用 Web Worker 进行计算）
  const runSimulation = async () => {
    // 使用 toRaw 将 Vue 响应式对象转换为普通对象，以便传递给 Worker
    const attackerSide = {
      ships: toRaw(attackerFleet.value),
      weaponTech: attackerTech.value.weapon,
      shieldTech: attackerTech.value.shield,
      armorTech: attackerTech.value.armor
    }

    const defenderSide = {
      ships: toRaw(defenderFleet.value),
      defense: toRaw(defenderDefense.value),
      weaponTech: defenderTech.value.weapon,
      shieldTech: defenderTech.value.shield,
      armorTech: defenderTech.value.armor
    }

    // 使用 Worker 执行战斗模拟
    const result = await workerManager.simulateBattle({
      attacker: attackerSide,
      defender: defenderSide
    })

    // 计算掠夺和残骸场
    const plunder =
      result.winner === 'attacker'
        ? await workerManager.calculatePlunder({
            defenderResources: toRaw(defenderResources.value),
            attackerFleet: result.attackerRemaining
          })
        : { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }
    const debrisField = await workerManager.calculateDebris({
      attackerLosses: result.attackerLosses,
      defenderLosses: result.defenderLosses
    })
    const moonChance = planetLogic.calculateMoonChance(debrisField) / 100 // 转换为 0-1 范围

    simulationResult.value = {
      id: `sim_${Date.now()}`,
      timestamp: Date.now(),
      attackerId: 'simulator_attacker',
      defenderId: 'simulator_defender',
      attackerPlanetId: 'sim_attacker',
      defenderPlanetId: 'sim_defender',
      attackerFleet: attackerFleet.value,
      defenderFleet: defenderFleet.value,
      defenderDefense: defenderDefense.value,
      attackerLosses: result.attackerLosses,
      defenderLosses: result.defenderLosses,
      winner: result.winner,
      plunder,
      debrisField,
      rounds: result.rounds,
      attackerRemaining: result.attackerRemaining,
      defenderRemaining: result.defenderRemaining,
      roundDetails: result.roundDetails,
      moonChance
    }

    // 显示结果对话框
    showResultDialog.value = true
  }

  // 重置模拟
  const resetSimulation = () => {
    Object.keys(attackerFleet.value).forEach(key => {
      attackerFleet.value[key as ShipType] = 0
    })
    Object.keys(defenderFleet.value).forEach(key => {
      defenderFleet.value[key as ShipType] = 0
    })
    Object.keys(defenderDefense.value).forEach(key => {
      defenderDefense.value[key as DefenseType] = 0
    })
    attackerTech.value = { weapon: 0, shield: 0, armor: 0 }
    defenderTech.value = { weapon: 0, shield: 0, armor: 0 }
    simulationResult.value = null
    showResultDialog.value = false
  }
</script>
