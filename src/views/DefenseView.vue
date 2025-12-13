<template>
  <div v-if="planet" class="container mx-auto p-4 sm:p-6">
    <!-- 未解锁遮罩 -->
    <UnlockRequirement :required-building="BuildingType.Shipyard" :required-level="1" />

    <h1 class="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{{ t('defenseView.title') }}</h1>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      <Card v-for="defenseType in Object.values(DefenseType)" :key="defenseType" class="relative">
        <CardUnlockOverlay :requirements="DEFENSES[defenseType].requirements" />
        <CardHeader>
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0 flex-1">
              <CardTitle
                class="text-base sm:text-lg cursor-pointer hover:text-primary transition-colors"
                @click="detailDialog.openDefense(defenseType)"
              >
                {{ DEFENSES[defenseType].name }}
              </CardTitle>
              <CardDescription class="text-xs sm:text-sm">{{ DEFENSES[defenseType].description }}</CardDescription>
            </div>
            <Badge variant="secondary" class="text-xs whitespace-nowrap flex-shrink-0">
              {{ planet.defense[defenseType] }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-3 sm:space-y-4">
            <div class="grid grid-cols-2 gap-2 text-xs sm:text-sm">
              <div>
                <p class="text-muted-foreground">{{ t('defenseView.attack') }}</p>
                <p class="font-medium">{{ DEFENSES[defenseType].attack }}</p>
              </div>
              <div>
                <p class="text-muted-foreground">{{ t('defenseView.shield') }}</p>
                <p class="font-medium">{{ DEFENSES[defenseType].shield }}</p>
              </div>
              <div>
                <p class="text-muted-foreground">{{ t('defenseView.armor') }}</p>
                <p class="font-medium">{{ DEFENSES[defenseType].armor }}</p>
              </div>
              <div>
                <p class="text-muted-foreground">{{ t('defenseView.buildTime') }}</p>
                <p class="font-medium">{{ DEFENSES[defenseType].buildTime }}{{ t('defenseView.seconds') }}</p>
              </div>
            </div>

            <div class="text-xs sm:text-sm space-y-1.5 sm:space-y-2">
              <p class="text-muted-foreground mb-1 sm:mb-2">{{ t('defenseView.unitCost') }}:</p>
              <div class="space-y-1 sm:space-y-1.5">
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <ResourceIcon type="metal" size="sm" />
                  <span class="text-xs">{{ t('resources.metal') }}:</span>
                  <span
                    class="font-medium text-xs sm:text-sm"
                    :class="getResourceCostColor(planet.resources.metal, DEFENSES[defenseType].cost.metal)"
                  >
                    {{ formatNumber(DEFENSES[defenseType].cost.metal) }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <ResourceIcon type="crystal" size="sm" />
                  <span class="text-xs">{{ t('resources.crystal') }}:</span>
                  <span
                    class="font-medium text-xs sm:text-sm"
                    :class="getResourceCostColor(planet.resources.crystal, DEFENSES[defenseType].cost.crystal)"
                  >
                    {{ formatNumber(DEFENSES[defenseType].cost.crystal) }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <ResourceIcon type="deuterium" size="sm" />
                  <span class="text-xs">{{ t('resources.deuterium') }}:</span>
                  <span
                    class="font-medium text-xs sm:text-sm"
                    :class="getResourceCostColor(planet.resources.deuterium, DEFENSES[defenseType].cost.deuterium)"
                  >
                    {{ formatNumber(DEFENSES[defenseType].cost.deuterium) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <Label :for="`quantity-${defenseType}`" class="text-xs sm:text-sm">{{ t('defenseView.buildQuantity') }}</Label>
              <Input
                :id="`quantity-${defenseType}`"
                v-model.number="quantities[defenseType]"
                type="number"
                min="0"
                :max="isShieldDome(defenseType) && planet.defense[defenseType] > 0 ? 0 : undefined"
                :disabled="isShieldDome(defenseType) && planet.defense[defenseType] > 0"
                placeholder="0"
                class="text-sm"
              />
              <p v-if="isShieldDome(defenseType) && planet.defense[defenseType] > 0" class="text-xs text-muted-foreground">
                {{ t('defenseView.shieldDomeBuilt') }}
              </p>
            </div>

            <div v-if="quantities[defenseType] > 0" class="text-xs sm:text-sm space-y-1.5 sm:space-y-2 p-2.5 sm:p-3 bg-muted rounded-lg">
              <p class="font-medium text-muted-foreground">{{ t('defenseView.totalCost') }}:</p>
              <div class="space-y-1 sm:space-y-1.5">
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <ResourceIcon type="metal" size="sm" />
                  <span class="text-xs">{{ t('resources.metal') }}:</span>
                  <span
                    class="font-medium text-xs sm:text-sm"
                    :class="getResourceCostColor(planet.resources.metal, getTotalCost(defenseType).metal)"
                  >
                    {{ formatNumber(getTotalCost(defenseType).metal) }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <ResourceIcon type="crystal" size="sm" />
                  <span class="text-xs">{{ t('resources.crystal') }}:</span>
                  <span
                    class="font-medium text-xs sm:text-sm"
                    :class="getResourceCostColor(planet.resources.crystal, getTotalCost(defenseType).crystal)"
                  >
                    {{ formatNumber(getTotalCost(defenseType).crystal) }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <ResourceIcon type="deuterium" size="sm" />
                  <span class="text-xs">{{ t('resources.deuterium') }}:</span>
                  <span
                    class="font-medium text-xs sm:text-sm"
                    :class="getResourceCostColor(planet.resources.deuterium, getTotalCost(defenseType).deuterium)"
                  >
                    {{ formatNumber(getTotalCost(defenseType).deuterium) }}
                  </span>
                </div>
              </div>
            </div>

            <Button @click="handleBuild(defenseType)" :disabled="!canBuild(defenseType)" class="w-full">
              {{ t('defenseView.build') }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 提示对话框 -->
    <AlertDialog ref="alertDialog" />
  </div>
</template>

<script setup lang="ts">
  import { useGameStore } from '@/stores/gameStore'
  import { useDetailDialogStore } from '@/stores/detailDialogStore'
  import { useI18n } from '@/composables/useI18n'
  import { useGameConfig } from '@/composables/useGameConfig'
  import { computed, ref } from 'vue'
  import { DefenseType, BuildingType } from '@/types/game'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Badge } from '@/components/ui/badge'
  import ResourceIcon from '@/components/ResourceIcon.vue'
  import AlertDialog from '@/components/AlertDialog.vue'
  import UnlockRequirement from '@/components/UnlockRequirement.vue'
  import CardUnlockOverlay from '@/components/CardUnlockOverlay.vue'
  import { formatNumber, getResourceCostColor } from '@/utils/format'
  import * as publicLogic from '@/logic/publicLogic'
  import * as shipValidation from '@/logic/shipValidation'

  const gameStore = useGameStore()
  const detailDialog = useDetailDialogStore()
  const { t } = useI18n()
  const { DEFENSES } = useGameConfig()
  const planet = computed(() => gameStore.currentPlanet)
  const alertDialog = ref<InstanceType<typeof AlertDialog> | null>(null)

  // 每种防御设施的建造数量
  const quantities = ref<Record<DefenseType, number>>({
    [DefenseType.RocketLauncher]: 0,
    [DefenseType.LightLaser]: 0,
    [DefenseType.HeavyLaser]: 0,
    [DefenseType.GaussCannon]: 0,
    [DefenseType.IonCannon]: 0,
    [DefenseType.PlasmaTurret]: 0,
    [DefenseType.SmallShieldDome]: 0,
    [DefenseType.LargeShieldDome]: 0,
    [DefenseType.PlanetaryShield]: 0
  })

  // 判断是否为护盾罩
  const isShieldDome = (defenseType: DefenseType): boolean => {
    return defenseType === DefenseType.SmallShieldDome || defenseType === DefenseType.LargeShieldDome
  }

  const buildDefense = (defenseType: DefenseType, quantity: number): boolean => {
    if (!gameStore.currentPlanet) return false
    const validation = shipValidation.validateDefenseBuild(gameStore.currentPlanet, defenseType, quantity, gameStore.player.technologies)
    if (!validation.valid) return false
    const queueItem = shipValidation.executeDefenseBuild(gameStore.currentPlanet, defenseType, quantity, gameStore.player.officers)
    gameStore.currentPlanet.buildQueue.push(queueItem)
    return true
  }

  // 建造防御设施
  const handleBuild = (defenseType: DefenseType) => {
    const quantity = quantities.value[defenseType]
    if (quantity <= 0) {
      alertDialog.value?.show({
        title: t('defenseView.inputError'),
        message: t('defenseView.inputErrorMessage')
      })
      return
    }

    const success = buildDefense(defenseType, quantity)
    if (!success) {
      alertDialog.value?.show({
        title: t('defenseView.buildFailed'),
        message: t('defenseView.buildFailedMessage')
      })
    } else {
      quantities.value[defenseType] = 0
    }
  }

  // 检查是否可以建造
  const canBuild = (defenseType: DefenseType): boolean => {
    if (!planet.value) return false

    const quantity = quantities.value[defenseType]
    if (quantity <= 0) return false

    // 护盾罩只能建造一个
    if (isShieldDome(defenseType)) {
      if (planet.value.defense[defenseType] > 0) return false
      if (quantity > 1) return false
    }

    const config = DEFENSES.value[defenseType]
    const totalCost = {
      metal: config.cost.metal * quantity,
      crystal: config.cost.crystal * quantity,
      deuterium: config.cost.deuterium * quantity
    }

    return (
      publicLogic.checkRequirements(planet.value, gameStore.player.technologies, config.requirements) &&
      planet.value.resources.metal >= totalCost.metal &&
      planet.value.resources.crystal >= totalCost.crystal &&
      planet.value.resources.deuterium >= totalCost.deuterium
    )
  }

  // 计算总成本
  const getTotalCost = (defenseType: DefenseType) => {
    const quantity = quantities.value[defenseType]
    const config = DEFENSES.value[defenseType]
    return {
      metal: config.cost.metal * quantity,
      crystal: config.cost.crystal * quantity,
      deuterium: config.cost.deuterium * quantity
    }
  }
</script>
