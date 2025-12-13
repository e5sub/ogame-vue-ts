<template>
  <div class="space-y-4">
    <!-- 科技等级范围表格 -->
    <div class="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-20 text-center">{{ t('research.levelRange') }}</TableHead>
            <TableHead class="text-center">{{ t('resources.metal') }}</TableHead>
            <TableHead class="text-center">{{ t('resources.crystal') }}</TableHead>
            <TableHead class="text-center">{{ t('resources.deuterium') }}</TableHead>
            <TableHead class="text-center">{{ t('research.researchTime') }}</TableHead>
            <TableHead class="text-center">{{ t('player.points') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="level in levelRange" :key="level" :class="{ 'bg-muted/50': level === currentLevel }">
            <TableCell class="text-center font-medium">
              <Badge v-if="level === currentLevel" variant="default">{{ level }}</Badge>
              <span v-else>{{ level }}</span>
            </TableCell>
            <TableCell class="text-center text-sm">
              <NumberWithTooltip :value="getLevelData(level).cost.metal" />
            </TableCell>
            <TableCell class="text-center text-sm">
              <NumberWithTooltip :value="getLevelData(level).cost.crystal" />
            </TableCell>
            <TableCell class="text-center text-sm">
              <NumberWithTooltip :value="getLevelData(level).cost.deuterium" />
            </TableCell>
            <TableCell class="text-center text-sm">{{ formatTime(getLevelData(level).researchTime) }}</TableCell>
            <TableCell class="text-center text-sm">
              <span class="text-primary font-medium">
                +
                <NumberWithTooltip :value="getLevelData(level).points" />
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- 累积统计 -->
    <div class="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader class="pb-3">
          <CardTitle class="text-sm">{{ t('research.totalCost') }}</CardTitle>
        </CardHeader>
        <CardContent class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">{{ t('resources.metal') }}:</span>
            <span class="font-medium">
              <NumberWithTooltip :value="totalStats.metal" />
            </span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">{{ t('resources.crystal') }}:</span>
            <span class="font-medium">
              <NumberWithTooltip :value="totalStats.crystal" />
            </span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">{{ t('resources.deuterium') }}:</span>
            <span class="font-medium">
              <NumberWithTooltip :value="totalStats.deuterium" />
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-3">
          <CardTitle class="text-sm">{{ t('research.totalPoints') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-bold text-primary">
            <NumberWithTooltip :value="totalStats.points" />
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            {{ t('research.levelRange') }}: {{ Math.max(0, currentLevel - 10) }} - {{ Math.min(currentLevel + 10, currentLevel + 10) }}
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from '@/composables/useI18n'
  import type { TechnologyType } from '@/types/game'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  import { Badge } from '@/components/ui/badge'
  import NumberWithTooltip from '@/components/NumberWithTooltip.vue'
  import * as researchLogic from '@/logic/researchLogic'
  import * as pointsLogic from '@/logic/pointsLogic'
  import { formatTime } from '@/utils/format'

  const { t } = useI18n()

  const props = defineProps<{
    technologyType: TechnologyType
    currentLevel: number
  }>()

  // 等级范围：当前等级 +10
  const levelRange = computed(() => {
    const end = props.currentLevel + 10
    const levels = []
    for (let i = props.currentLevel; i <= end; i++) {
      levels.push(i)
    }
    return levels
  })

  // 获取某个等级的详细数据
  const getLevelData = (level: number) => {
    if (level === 0) {
      return {
        cost: { metal: 0, crystal: 0, deuterium: 0 },
        researchTime: 0,
        points: 0
      }
    }

    const cost = researchLogic.calculateTechnologyCost(props.technologyType, level)
    const researchTime = researchLogic.calculateTechnologyTime(props.technologyType, level - 1)

    // 计算积分
    const points = pointsLogic.calculateTechnologyPoints(props.technologyType, level - 1, level)

    return {
      cost,
      researchTime,
      points
    }
  }

  // 累积统计
  const totalStats = computed(() => {
    let metal = 0
    let crystal = 0
    let deuterium = 0
    let points = 0

    for (const level of levelRange.value) {
      if (level === 0) continue
      const data = getLevelData(level)
      metal += data.cost.metal
      crystal += data.cost.crystal
      deuterium += data.cost.deuterium
      points += data.points
    }

    return { metal, crystal, deuterium, points }
  })
</script>
