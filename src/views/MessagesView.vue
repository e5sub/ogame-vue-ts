<template>
  <div class="container mx-auto p-4 sm:p-6 space-y-6">
    <h1 class="text-2xl sm:text-3xl font-bold">{{ t('messagesView.title') }}</h1>

    <!-- 标签切换 -->
    <div class="flex gap-2 border-b">
      <Button @click="activeTab = 'battles'" :variant="activeTab === 'battles' ? 'default' : 'ghost'" class="rounded-b-none">
        <Sword class="h-4 w-4 mr-2" />
        {{ t('messagesView.battles') }}
        <Badge v-if="unreadBattles > 0" variant="destructive" class="ml-2">{{ unreadBattles }}</Badge>
      </Button>
      <Button @click="activeTab = 'spy'" :variant="activeTab === 'spy' ? 'default' : 'ghost'" class="rounded-b-none">
        <Eye class="h-4 w-4 mr-2" />
        {{ t('messagesView.spy') }}
        <Badge v-if="unreadSpyReports > 0" variant="destructive" class="ml-2">{{ unreadSpyReports }}</Badge>
      </Button>
    </div>

    <!-- 战斗报告列表 -->
    <div v-if="activeTab === 'battles'" class="space-y-2">
      <Card v-if="gameStore.player.battleReports.length === 0">
        <CardContent class="py-8 text-center text-muted-foreground">{{ t('messagesView.noBattleReports') }}</CardContent>
      </Card>

      <Card
        v-for="report in sortedBattleReports"
        :key="report.id"
        @click="openBattleReport(report)"
        class="cursor-pointer hover:shadow-md transition-shadow"
      >
        <CardHeader class="pb-3">
          <div class="flex justify-between items-center gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <Sword class="h-4 w-4 flex-shrink-0" />
              <CardTitle class="text-base sm:text-lg">{{ t('messagesView.battleReport') }}</CardTitle>
              <Badge v-if="!report.read" variant="default" class="text-xs">{{ t('messagesView.unread') }}</Badge>
              <Badge
                :variant="report.winner === 'attacker' ? 'default' : report.winner === 'defender' ? 'destructive' : 'secondary'"
                class="text-xs"
              >
                {{ report.winner === 'attacker' ? t('messagesView.victory') : report.winner === 'defender' ? t('messagesView.defeat') : t('messagesView.draw') }}
              </Badge>
            </div>
            <Button @click.stop="deleteBattleReport(report.id)" variant="ghost" size="icon" class="h-8 w-8 flex-shrink-0">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <CardDescription class="text-xs sm:text-sm">
            {{ formatDate(report.timestamp) }}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>

    <!-- 间谍报告列表 -->
    <div v-if="activeTab === 'spy'" class="space-y-2">
      <Card v-if="gameStore.player.spyReports.length === 0">
        <CardContent class="py-8 text-center text-muted-foreground">{{ t('messagesView.noSpyReports') }}</CardContent>
      </Card>

      <Card
        v-for="report in sortedSpyReports"
        :key="report.id"
        @click="openSpyReport(report)"
        class="cursor-pointer hover:shadow-md transition-shadow"
      >
        <CardHeader class="pb-3">
          <div class="flex justify-between items-center gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <Eye class="h-4 w-4 flex-shrink-0" />
              <CardTitle class="text-base sm:text-lg">{{ t('messagesView.spyReport') }}</CardTitle>
              <Badge v-if="!report.read" variant="default" class="text-xs">{{ t('messagesView.unread') }}</Badge>
              <Badge variant="outline" class="text-xs">{{ report.targetPlanetId }}</Badge>
            </div>
            <Button @click.stop="deleteSpyReport(report.id)" variant="ghost" size="icon" class="h-8 w-8 flex-shrink-0">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <CardDescription class="text-xs sm:text-sm">
            {{ formatDate(report.timestamp) }}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>

    <!-- 战斗报告对话框 -->
    <BattleReportDialog v-model:open="showBattleDialog" :report="selectedBattleReport" />

    <!-- 间谍报告对话框 -->
    <SpyReportDialog v-model:open="showSpyDialog" :report="selectedSpyReport" />
  </div>
</template>

<script setup lang="ts">
  import { useGameStore } from '@/stores/gameStore'
  import { useI18n } from '@/composables/useI18n'
  import { computed, ref } from 'vue'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import BattleReportDialog from '@/components/BattleReportDialog.vue'
  import SpyReportDialog from '@/components/SpyReportDialog.vue'
  import { formatDate } from '@/utils/format'
  import { X, Sword, Eye } from 'lucide-vue-next'
  import type { BattleResult, SpyReport } from '@/types/game'

  const gameStore = useGameStore()
  const { t } = useI18n()
  const activeTab = ref<'battles' | 'spy'>('battles')

  // 对话框状态
  const showBattleDialog = ref(false)
  const showSpyDialog = ref(false)
  const selectedBattleReport = ref<BattleResult | null>(null)
  const selectedSpyReport = ref<SpyReport | null>(null)

  // 排序后的战斗报告（最新的在前）
  const sortedBattleReports = computed(() => {
    return [...gameStore.player.battleReports].sort((a, b) => b.timestamp - a.timestamp)
  })

  // 排序后的间谍报告（最新的在前）
  const sortedSpyReports = computed(() => {
    return [...gameStore.player.spyReports].sort((a, b) => b.timestamp - a.timestamp)
  })

  // 未读战斗报告数量
  const unreadBattles = computed(() => {
    return gameStore.player.battleReports.filter(r => !r.read).length
  })

  // 未读间谍报告数量
  const unreadSpyReports = computed(() => {
    return gameStore.player.spyReports.filter(r => !r.read).length
  })

  // 打开战斗报告
  const openBattleReport = (report: BattleResult) => {
    selectedBattleReport.value = report
    showBattleDialog.value = true
    // 标记为已读
    if (!report.read) {
      report.read = true
    }
  }

  // 打开间谍报告
  const openSpyReport = (report: SpyReport) => {
    selectedSpyReport.value = report
    showSpyDialog.value = true
    // 标记为已读
    if (!report.read) {
      report.read = true
    }
  }

  // 删除战斗报告
  const deleteBattleReport = (reportId: string) => {
    const index = gameStore.player.battleReports.findIndex(r => r.id === reportId)
    if (index > -1) {
      gameStore.player.battleReports.splice(index, 1)
    }
  }

  // 删除间谍报告
  const deleteSpyReport = (reportId: string) => {
    const index = gameStore.player.spyReports.findIndex(r => r.id === reportId)
    if (index > -1) {
      gameStore.player.spyReports.splice(index, 1)
    }
  }
</script>
