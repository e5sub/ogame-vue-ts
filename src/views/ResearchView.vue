<template>
  <div v-if="planet" class="container mx-auto p-4 sm:p-6">
    <!-- 未解锁遮罩 -->
    <UnlockRequirement :required-building="BuildingType.ResearchLab" :required-level="1" />

    <h1 class="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{{ t('researchView.title') }}</h1>

    <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <Card v-for="techType in Object.values(TechnologyType)" :key="techType" class="relative">
        <CardUnlockOverlay :requirements="TECHNOLOGIES[techType].requirements" :currentLevel="getTechLevel(techType)" />
        <CardHeader>
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0 flex-1">
              <CardTitle
                class="text-base sm:text-lg cursor-pointer hover:text-primary transition-colors"
                @click="detailDialog.openTechnology(techType, getTechLevel(techType))"
              >
                {{ TECHNOLOGIES[techType].name }}
              </CardTitle>
              <CardDescription class="text-xs sm:text-sm">{{ TECHNOLOGIES[techType].description }}</CardDescription>
            </div>
            <Badge variant="secondary" class="text-xs whitespace-nowrap flex-shrink-0">Lv {{ getTechLevel(techType) }}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-2.5 sm:space-y-3">
            <div class="text-xs sm:text-sm space-y-1.5 sm:space-y-2">
              <p class="text-muted-foreground mb-1 sm:mb-2">{{ t('researchView.researchCost') }}:</p>
              <div class="space-y-1 sm:space-y-1.5">
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <ResourceIcon type="metal" size="sm" />
                  <span class="text-xs">{{ t('resources.metal') }}:</span>
                  <span
                    class="font-medium text-xs sm:text-sm"
                    :class="getResourceCostColor(planet.resources.metal, getTechnologyCost(techType, getTechLevel(techType) + 1).metal)"
                  >
                    {{ formatNumber(getTechnologyCost(techType, getTechLevel(techType) + 1).metal) }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <ResourceIcon type="crystal" size="sm" />
                  <span class="text-xs">{{ t('resources.crystal') }}:</span>
                  <span
                    class="font-medium text-xs sm:text-sm"
                    :class="getResourceCostColor(planet.resources.crystal, getTechnologyCost(techType, getTechLevel(techType) + 1).crystal)"
                  >
                    {{ formatNumber(getTechnologyCost(techType, getTechLevel(techType) + 1).crystal) }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <ResourceIcon type="deuterium" size="sm" />
                  <span class="text-xs">{{ t('resources.deuterium') }}:</span>
                  <span
                    class="font-medium text-xs sm:text-sm"
                    :class="
                      getResourceCostColor(planet.resources.deuterium, getTechnologyCost(techType, getTechLevel(techType) + 1).deuterium)
                    "
                  >
                    {{ formatNumber(getTechnologyCost(techType, getTechLevel(techType) + 1).deuterium) }}
                  </span>
                </div>
              </div>
            </div>

            <Button @click="handleResearch(techType)" :disabled="!canResearch(techType)" class="w-full">
              {{ getResearchButtonText(techType) }}
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
  import { TechnologyType, BuildingType } from '@/types/game'
  import type { Resources } from '@/types/game'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import ResourceIcon from '@/components/ResourceIcon.vue'
  import AlertDialog from '@/components/AlertDialog.vue'
  import UnlockRequirement from '@/components/UnlockRequirement.vue'
  import CardUnlockOverlay from '@/components/CardUnlockOverlay.vue'
  import { formatNumber, getResourceCostColor } from '@/utils/format'
  import * as publicLogic from '@/logic/publicLogic'
  import * as researchLogic from '@/logic/researchLogic'
  import * as researchValidation from '@/logic/researchValidation'

  const gameStore = useGameStore()
  const detailDialog = useDetailDialogStore()
  const { t } = useI18n()
  const { TECHNOLOGIES, BUILDINGS } = useGameConfig()
  const planet = computed(() => gameStore.currentPlanet)
  const player = computed(() => gameStore.player)
  const alertDialog = ref<InstanceType<typeof AlertDialog> | null>(null)

  const researchTechnology = (techType: TechnologyType): boolean => {
    if (!gameStore.currentPlanet) return false
    const validation = researchValidation.validateTechnologyResearch(
      gameStore.currentPlanet,
      techType,
      gameStore.player.technologies,
      gameStore.player.researchQueue
    )
    if (!validation.valid) return false
    const currentLevel = gameStore.player.technologies[techType] || 0
    const { queueItem } = researchValidation.executeTechnologyResearch(
      gameStore.currentPlanet,
      techType,
      currentLevel,
      gameStore.player.officers
    )
    gameStore.player.researchQueue.push(queueItem)
    return true
  }

  // 检查升级前置条件是否满足
  const checkUpgradeRequirements = (techType: TechnologyType): boolean => {
    if (!planet.value) return false
    const config = TECHNOLOGIES.value[techType]
    const currentLevel = getTechLevel(techType)
    const targetLevel = currentLevel + 1

    // 获取目标等级的所有前置条件（包括等级门槛）
    const requirements = publicLogic.getLevelRequirements(config, targetLevel)

    if (!requirements || Object.keys(requirements).length === 0) return true
    return publicLogic.checkRequirements(planet.value, gameStore.player.technologies, requirements)
  }

  // 获取研究按钮文本
  const getResearchButtonText = (techType: TechnologyType): string => {
    if (!planet.value) return t('researchView.research')

    const config = TECHNOLOGIES.value[techType]
    const currentLevel = getTechLevel(techType)

    // 检查是否达到等级上限
    if (config.maxLevel !== undefined && currentLevel >= config.maxLevel) {
      return t('researchView.maxLevelReached') // "等级已满"
    }

    if (player.value.researchQueue.length > 0) return t('researchView.research')

    // 检查前置条件
    if (!checkUpgradeRequirements(techType)) {
      return t('buildingsView.requirementsNotMet') // "条件不足"
    }

    return t('researchView.research') // "研究"
  }

  // 获取前置条件列表文本
  const getRequirementsList = (techType: TechnologyType): string => {
    const config = TECHNOLOGIES.value[techType]
    const currentLevel = getTechLevel(techType)
    const targetLevel = currentLevel + 1

    // 获取目标等级的所有前置条件（包括等级门槛）
    const requirements = publicLogic.getLevelRequirements(config, targetLevel)

    if (!requirements || !planet.value) return ''

    const lines: string[] = []
    for (const [key, requiredLevel] of Object.entries(requirements)) {
      // 检查是否为建筑类型
      if (Object.values(BuildingType).includes(key as BuildingType)) {
        const bt = key as BuildingType
        const currentLevel = planet.value.buildings[bt] || 0
        const name = BUILDINGS.value[bt]?.name || bt
        const status = currentLevel >= requiredLevel ? '✓' : '✗'
        lines.push(`${status} ${name}: Lv ${requiredLevel} (${t('common.current')}: Lv ${currentLevel})`)
      }
      // 检查是否为科技类型
      else if (Object.values(TechnologyType).includes(key as TechnologyType)) {
        const tt = key as TechnologyType
        const currentLevel = gameStore.player.technologies[tt] || 0
        const name = TECHNOLOGIES.value[tt]?.name || tt
        const status = currentLevel >= requiredLevel ? '✓' : '✗'
        lines.push(`${status} ${name}: Lv ${requiredLevel} (${t('common.current')}: Lv ${currentLevel})`)
      }
    }
    return lines.join('\n')
  }

  // 研究科技
  const handleResearch = (techType: TechnologyType) => {
    // 检查前置条件
    if (!checkUpgradeRequirements(techType)) {
      alertDialog.value?.show({
        title: t('common.requirementsNotMet'),
        message: getRequirementsList(techType)
      })
      return
    }

    const success = researchTechnology(techType)
    if (!success) {
      alertDialog.value?.show({
        title: t('researchView.researchFailed'),
        message: t('researchView.researchFailedMessage')
      })
    }
  }

  // 获取科技等级
  const getTechLevel = (techType: TechnologyType): number => {
    return player.value.technologies[techType] || 0
  }

  // 检查是否可以研究
  const canResearch = (techType: TechnologyType): boolean => {
    if (!planet.value) return false

    const config = TECHNOLOGIES.value[techType]
    const currentLevel = getTechLevel(techType)

    // 检查是否达到等级上限
    if (config.maxLevel !== undefined && currentLevel >= config.maxLevel) {
      return false
    }

    if (player.value.researchQueue.length > 0) return false

    const cost = getTechnologyCost(techType, currentLevel + 1)

    return (
      publicLogic.checkRequirements(planet.value, gameStore.player.technologies, config.requirements) &&
      planet.value.resources.metal >= cost.metal &&
      planet.value.resources.crystal >= cost.crystal &&
      planet.value.resources.deuterium >= cost.deuterium
    )
  }

  const getTechnologyCost = (techType: TechnologyType, targetLevel: number): Resources => {
    return researchLogic.calculateTechnologyCost(techType, targetLevel)
  }
</script>
