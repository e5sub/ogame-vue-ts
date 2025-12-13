<template>
  <div v-if="planet" class="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
    <!-- 星球信息 -->
    <div class="text-center">
      <h1 class="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 flex items-center justify-center gap-2">
        {{ planet.name }}
        <Badge v-if="planet.isMoon" variant="secondary">{{ t('planet.moon') }}</Badge>
      </h1>
      <p class="text-xs sm:text-sm text-muted-foreground">
        {{ t('planet.position') }}: [{{ planet.position.galaxy }}:{{ planet.position.system }}:{{ planet.position.position }}]
      </p>
      <!-- 月球信息 -->
      <div v-if="!planet.isMoon && moon" class="mt-2">
        <Button @click="switchToMoon" variant="outline" size="sm">
          <span class="mr-2">🌙</span>
          {{ t('planet.switchToMoon') }}
        </Button>
      </div>
      <div v-if="planet.isMoon" class="mt-2">
        <Button @click="switchToParentPlanet" variant="outline" size="sm">{{ t('planet.backToPlanet') }}</Button>
      </div>
    </div>

    <!-- 资源显示 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t('overview.resourceOverview') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('common.resourceType') }}</TableHead>
              <TableHead class="text-right">{{ t('resources.current') }}</TableHead>
              <TableHead class="text-right">{{ t('resources.max') }}</TableHead>
              <TableHead class="text-right">{{ t('resources.production') }}{{ t('resources.perHour') }}</TableHead>
              <TableHead class="text-right">{{ t('resources.consumption') }}{{ t('resources.perHour') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="resourceType in resourceTypes" :key="resourceType.key">
              <TableCell class="font-medium">
                <div class="flex items-center gap-2">
                  <ResourceIcon :type="resourceType.key" size="sm" />
                  {{ t(`resources.${resourceType.key}`) }}
                </div>
              </TableCell>
              <!-- 所有资源统一显示 -->
              <TableCell
                class="text-right"
                :class="getResourceColor(planet.resources[resourceType.key], capacity?.[resourceType.key] || Infinity)"
              >
                {{ formatNumber(planet.resources[resourceType.key]) }}
              </TableCell>
              <TableCell class="text-right text-muted-foreground">
                {{ formatNumber(capacity?.[resourceType.key] || 0) }}
              </TableCell>
              <TableCell class="text-right text-green-600 dark:text-green-400">
                +{{ formatNumber(production?.[resourceType.key] || 0) }}
              </TableCell>
              <TableCell class="text-right text-red-600 dark:text-red-400">
                <template v-if="resourceType.key === 'energy'">
                  -{{ formatNumber(energyConsumption) }}
                </template>
                <template v-else>
                  -
                </template>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- 资源获取来源 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t('overview.productionSources') }}</CardTitle>
        <CardDescription>{{ t('overview.productionSourcesDesc') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div v-for="resourceType in resourceTypes" :key="resourceType.key" class="border-b last:border-b-0 pb-4 last:pb-0">
            <div class="flex items-center gap-2 mb-2">
              <ResourceIcon :type="resourceType.key" size="sm" />
              <span class="font-semibold">{{ t(`resources.${resourceType.key}`) }}</span>
            </div>

            <div v-if="productionBreakdown" class="ml-6 space-y-1 text-sm">
              <!-- 建筑基础产量 -->
              <div class="flex justify-between">
                <span class="text-muted-foreground">
                  {{ t(productionBreakdown[resourceType.key].buildingName) }}
                  ({{ t('common.level') }} {{ productionBreakdown[resourceType.key].buildingLevel }})
                </span>
                <span class="text-green-600 dark:text-green-400">
                  +{{ formatNumber(Math.floor(productionBreakdown[resourceType.key].baseProduction)) }}/{{ t('resources.hour') }}
                </span>
              </div>

              <!-- 加成列表 -->
              <div v-for="(bonus, idx) in productionBreakdown[resourceType.key].bonuses" :key="idx" class="flex justify-between">
                <span class="text-muted-foreground ml-4">
                  {{ t(bonus.name) }}
                </span>
                <span :class="bonus.value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                  {{ bonus.value > 0 ? '+' : '' }}{{ bonus.value }}%
                </span>
              </div>

              <!-- 最终产量 -->
              <div class="flex justify-between font-semibold pt-1 border-t mt-1">
                <span>{{ t('overview.totalProduction') }}</span>
                <span class="text-green-600 dark:text-green-400">
                  +{{ formatNumber(Math.floor(productionBreakdown[resourceType.key].finalProduction)) }}/{{ t('resources.hour') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 资源消耗来源 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t('overview.consumptionSources') }}</CardTitle>
        <CardDescription>{{ t('overview.consumptionSourcesDesc') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-2">
          <!-- 金属矿消耗 -->
          <div v-if="consumptionBreakdown && consumptionBreakdown.metalMine.buildingLevel > 0" class="flex justify-between text-sm">
            <span class="text-muted-foreground">
              {{ t(consumptionBreakdown.metalMine.buildingName) }}
              ({{ t('common.level') }} {{ consumptionBreakdown.metalMine.buildingLevel }})
            </span>
            <span class="text-red-600 dark:text-red-400">
              -{{ formatNumber(Math.floor(consumptionBreakdown.metalMine.consumption)) }}/{{ t('resources.hour') }}
            </span>
          </div>

          <!-- 晶体矿消耗 -->
          <div v-if="consumptionBreakdown && consumptionBreakdown.crystalMine.buildingLevel > 0" class="flex justify-between text-sm">
            <span class="text-muted-foreground">
              {{ t(consumptionBreakdown.crystalMine.buildingName) }}
              ({{ t('common.level') }} {{ consumptionBreakdown.crystalMine.buildingLevel }})
            </span>
            <span class="text-red-600 dark:text-red-400">
              -{{ formatNumber(Math.floor(consumptionBreakdown.crystalMine.consumption)) }}/{{ t('resources.hour') }}
            </span>
          </div>

          <!-- 重氢合成器消耗 -->
          <div v-if="consumptionBreakdown && consumptionBreakdown.deuteriumSynthesizer.buildingLevel > 0" class="flex justify-between text-sm">
            <span class="text-muted-foreground">
              {{ t(consumptionBreakdown.deuteriumSynthesizer.buildingName) }}
              ({{ t('common.level') }} {{ consumptionBreakdown.deuteriumSynthesizer.buildingLevel }})
            </span>
            <span class="text-red-600 dark:text-red-400">
              -{{ formatNumber(Math.floor(consumptionBreakdown.deuteriumSynthesizer.consumption)) }}/{{ t('resources.hour') }}
            </span>
          </div>

          <!-- 总消耗 -->
          <div v-if="consumptionBreakdown" class="flex justify-between font-semibold pt-2 border-t">
            <span>{{ t('overview.totalConsumption') }}</span>
            <span class="text-red-600 dark:text-red-400">
              -{{ formatNumber(Math.floor(consumptionBreakdown.total)) }}/{{ t('resources.hour') }}
            </span>
          </div>

          <!-- 无消耗提示 -->
          <div v-if="consumptionBreakdown && consumptionBreakdown.total === 0" class="text-sm text-muted-foreground text-center py-2">
            {{ t('overview.noConsumption') }}
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 舰队信息 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t('overview.fleetInfo') }}</CardTitle>
        <CardDescription>{{ t('overview.currentShips') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          <div v-for="(count, shipType) in planet.fleet" :key="shipType">
            <p class="text-xs sm:text-sm text-muted-foreground">{{ SHIPS[shipType].name }}</p>
            <p class="text-lg sm:text-xl font-bold">{{ count }}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
  import { useGameStore } from '@/stores/gameStore'
  import { useI18n } from '@/composables/useI18n'
  import { useGameConfig } from '@/composables/useGameConfig'
  import { computed } from 'vue'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import ResourceIcon from '@/components/ResourceIcon.vue'
  import { formatNumber, getResourceColor } from '@/utils/format'
  import type { Planet } from '@/types/game'
  import * as publicLogic from '@/logic/publicLogic'
  import * as resourceLogic from '@/logic/resourceLogic'
  import * as officerLogic from '@/logic/officerLogic'

  const gameStore = useGameStore()
  const { t } = useI18n()
  const { SHIPS } = useGameConfig()
  const planet = computed(() => gameStore.currentPlanet)
  const production = computed(() => (planet.value ? publicLogic.getResourceProduction(planet.value, gameStore.player.officers) : null))
  const capacity = computed(() => (planet.value ? publicLogic.getResourceCapacity(planet.value, gameStore.player.officers) : null))

  // 能量消耗
  const energyConsumption = computed(() => {
    if (!planet.value) return 0
    return resourceLogic.calculateEnergyConsumption(planet.value)
  })

  // 资源产量详细breakdown
  const productionBreakdown = computed(() => {
    if (!planet.value) return null
    const bonuses = officerLogic.calculateActiveBonuses(gameStore.player.officers, Date.now())
    return resourceLogic.calculateProductionBreakdown(planet.value, bonuses)
  })

  // 资源消耗详细breakdown
  const consumptionBreakdown = computed(() => {
    if (!planet.value) return null
    return resourceLogic.calculateConsumptionBreakdown(planet.value)
  })

  // 资源类型配置
  const resourceTypes = [
    { key: 'metal' as const },
    { key: 'crystal' as const },
    { key: 'deuterium' as const },
    { key: 'darkMatter' as const },
    { key: 'energy' as const }
  ]

  // 月球相关
  const moon = computed(() => {
    if (!planet.value || planet.value.isMoon) return null
    return getMoonForPlanet(planet.value.id)
  })

  const getMoonForPlanet = (planetId: string): Planet | null => {
    return gameStore.player.planets.find(p => p.isMoon && p.parentPlanetId === planetId) || null
  }

  // 切换到月球
  const switchToMoon = () => {
    if (moon.value) {
      gameStore.currentPlanetId = moon.value.id
    }
  }

  // 切换回母星
  const switchToParentPlanet = () => {
    if (planet.value?.parentPlanetId) {
      gameStore.currentPlanetId = planet.value.parentPlanetId
    }
  }
</script>
