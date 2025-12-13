<template>
  <SidebarProvider :open="sidebarOpen" @update:open="sidebarOpen = $event">
    <Sidebar collapsible="icon">
      <!-- Logo -->
      <SidebarHeader class="border-b">
        <div class="flex items-center justify-center p-4 group-data-[collapsible=icon]:p-2">
          <img src="@/assets/logo.svg" class="w-10 group-data-[collapsible=icon]:w-8" />
          <h1 class="text-xl font-bold ml-2 group-data-[collapsible=icon]:hidden">{{ pkg.title }}</h1>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <!-- 星球信息 -->
        <SidebarGroup v-if="planet" class="border-b group-data-[collapsible=icon]:hidden">
          <div class="px-4 py-3 space-y-2 text-sm">
            <div>
              <p class="font-semibold mb-1">
                {{ planet.name }}
                <Badge v-if="planet.isMoon" variant="secondary" class="ml-1 text-xs">{{ t('planet.moon') }}</Badge>
              </p>
              <p class="text-muted-foreground text-xs">
                [{{ planet.position.galaxy }}:{{ planet.position.system }}:{{ planet.position.position }}]
              </p>
            </div>
            <!-- 玩家积分显示 -->
            <div class="bg-muted/50 rounded-lg p-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted-foreground">{{ t('player.points') }}</span>
                <span class="text-sm font-bold text-primary">{{ formatNumber(gameStore.player.points) }}</span>
              </div>
            </div>
            <!-- 月球切换按钮 -->
            <div v-if="hasMoon || planet.isMoon" class="flex gap-1">
              <Button v-if="planet.isMoon" @click="switchToParentPlanet" variant="outline" size="sm" class="w-full text-xs h-7">
                {{ t('planet.backToPlanet') }}
              </Button>
              <Button v-else-if="moon" @click="switchToMoon" variant="outline" size="sm" class="w-full text-xs h-7">
                {{ t('planet.switchToMoon') }}
              </Button>
            </div>
          </div>
        </SidebarGroup>

        <!-- 导航菜单 -->
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in navItems" :key="item.path">
              <SidebarMenuButton as-child :is-active="$route.path === item.path" :tooltip="item.name.value">
                <RouterLink :to="item.path">
                  <component :is="item.icon" />
                  <span>{{ item.name.value }}</span>
                  <!-- 未读消息数量 -->
                  <SidebarMenuBadge v-if="item.path === '/messages' && unreadMessagesCount > 0">
                    {{ unreadMessagesCount }}
                  </SidebarMenuBadge>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <!-- 底部设置 -->
      <SidebarFooter class="border-t">
        <SidebarMenu>
          <!-- 语言切换 -->
          <SidebarMenuItem>
            <Popover>
              <PopoverTrigger as-child>
                <SidebarMenuButton :tooltip="localeNames[gameStore.locale]">
                  <Languages />
                  <span>{{ localeNames[gameStore.locale] }}</span>
                </SidebarMenuButton>
              </PopoverTrigger>
              <PopoverContent class="w-48 p-2" side="right" align="end">
                <div class="space-y-1">
                  <Button
                    v-for="locale in locales"
                    :key="locale"
                    @click="gameStore.locale = locale"
                    :variant="gameStore.locale === locale ? 'secondary' : 'ghost'"
                    class="w-full justify-start"
                    size="sm"
                  >
                    {{ localeNames[locale] }}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>

          <!-- 夜间模式切换 -->
          <SidebarMenuItem>
            <SidebarMenuButton @click="isDark = !isDark" :tooltip="isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')">
              <Sun v-if="isDark" />
              <Moon v-else />
              <span>{{ isDark ? t('sidebar.lightMode') : t('sidebar.darkMode') }}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <!-- 折叠按钮 -->
          <SidebarMenuItem class="hidden sm:inline">
            <SidebarMenuButton @click="toggleSidebar" :tooltip="sidebarOpen ? t('sidebar.collapse') : t('sidebar.expand')">
              <ChevronsLeft class="group-data-[state=collapsed]:rotate-180 transition-transform" />
              <span>{{ t('sidebar.collapse') }}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>

    <!-- 主内容区 -->
    <SidebarInset>
      <div class="flex flex-col h-full overflow-hidden">
        <!-- 顶部资源栏 -->
        <header v-if="planet" class="bg-card border-b px-4 sm:px-6 py-6.5 shadow-md">
          <div class="flex items-center justify-between gap-3 sm:gap-6">
            <!-- 汉堡菜单（移动端）- 左侧占位 -->
            <div class="lg:flex-1">
              <SidebarTrigger class="lg:hidden" />
            </div>

            <!-- 资源显示 - PC端居中 -->
            <div class="flex items-center gap-3 sm:gap-6 flex-1 lg:flex-none overflow-x-auto lg:justify-center">
              <div v-for="resourceType in resourceTypes" :key="resourceType.key" class="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <ResourceIcon :type="resourceType.key" size="md" />
                <div class="min-w-0">
                  <!-- 所有资源统一显示：当前值/容量 -->
                  <p
                    class="text-xs sm:text-sm font-medium truncate"
                    :class="getResourceColor(planet.resources[resourceType.key], capacity?.[resourceType.key] || Infinity)"
                  >
                    {{ formatNumber(planet.resources[resourceType.key]) }} / {{ formatNumber(capacity?.[resourceType.key] || 0) }}
                  </p>
                  <p class="text-[10px] sm:text-xs text-muted-foreground truncate">
                    +{{ formatNumber(Math.round((production?.[resourceType.key] || 0) / 60)) }}/{{ t('resources.perMinute') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 右侧状态 - 右侧占位 -->
            <div class="flex items-center gap-2 sm:gap-4 flex-shrink-0 lg:flex-1 lg:justify-end">
              <!-- 建造队列状态 -->
              <div v-if="planet.buildQueue.length > 0" class="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <div class="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span class="text-muted-foreground hidden sm:inline">{{ t('queue.building') }}</span>
              </div>
              <div v-if="gameStore.player.researchQueue.length > 0" class="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <div class="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span class="text-muted-foreground hidden sm:inline">{{ t('queue.researching') }}</span>
              </div>
            </div>
          </div>
        </header>

        <!-- 建造队列 -->
        <div
          v-if="planet && (planet.buildQueue.length > 0 || gameStore.player.researchQueue.length > 0)"
          class="bg-card border-b px-4 sm:px-6 py-4.5"
        >
          <div class="space-y-3">
            <!-- 建造队列 -->
            <div v-for="item in planet.buildQueue" :key="item.id" class="space-y-1.5">
              <div class="flex items-center justify-between text-xs sm:text-sm gap-2">
                <div class="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                  <div class="h-2 w-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <span class="font-medium truncate">{{ getItemName(item) }}</span>
                  <span class="text-muted-foreground hidden sm:inline flex-shrink-0 text-[10px] sm:text-xs">
                    <template v-if="item.type === 'ship' || item.type === 'defense'">
                      → {{ t('queue.quantity') }} {{ item.quantity }}
                    </template>
                    <template v-else>→ {{ t('queue.level') }} {{ item.targetLevel }}</template>
                  </span>
                </div>
                <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <span class="text-muted-foreground text-[10px] sm:text-xs whitespace-nowrap">
                    {{ formatTime(getRemainingTime(item)) }}
                  </span>
                  <Button
                    @click="handleCancelBuild(item.id)"
                    variant="ghost"
                    size="sm"
                    class="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs"
                  >
                    {{ t('queue.cancel') }}
                  </Button>
                </div>
              </div>
              <Progress :model-value="getQueueProgress(item)" class="h-1.5" />
            </div>
            <!-- 研究队列 -->
            <div v-for="item in gameStore.player.researchQueue" :key="item.id" class="space-y-1.5">
              <div class="flex items-center justify-between text-xs sm:text-sm gap-2">
                <div class="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                  <div class="h-2 w-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                  <span class="font-medium truncate">{{ getItemName(item) }}</span>
                  <span class="text-muted-foreground hidden sm:inline flex-shrink-0 text-[10px] sm:text-xs">
                    → {{ t('queue.level') }} {{ item.targetLevel }}
                  </span>
                </div>
                <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <span class="text-muted-foreground text-[10px] sm:text-xs whitespace-nowrap">
                    {{ formatTime(getRemainingTime(item)) }}
                  </span>
                  <Button
                    @click="handleCancelResearch(item.id)"
                    variant="ghost"
                    size="sm"
                    class="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs"
                  >
                    {{ t('queue.cancel') }}
                  </Button>
                </div>
              </div>
              <Progress :model-value="getQueueProgress(item)" class="h-1.5" />
            </div>
          </div>
        </div>

        <!-- 内容区域 -->
        <main class="flex-1 overflow-y-auto">
          <div class="animate-fade-in">
            <RouterView />
          </div>
        </main>
      </div>
    </SidebarInset>

    <!-- 确认对话框 -->
    <ConfirmDialog ref="confirmDialog" />

    <!-- 详情弹窗 -->
    <DetailDialog />

    <!-- Toast 通知 -->
    <Sonner position="top-center" />
  </SidebarProvider>
</template>

<script setup lang="ts">
  import { onMounted, onUnmounted, computed, ref } from 'vue'
  import { RouterView, RouterLink } from 'vue-router'
  import { useGameStore } from '@/stores/gameStore'
  import { useUniverseStore } from '@/stores/universeStore'
  import { useTheme } from '@/composables/useTheme'
  import { useI18n } from '@/composables/useI18n'
  import { localeNames, detectBrowserLocale, type Locale } from '@/locales'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import { Progress } from '@/components/ui/progress'
  import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
  import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger
  } from '@/components/ui/sidebar'
  import ResourceIcon from '@/components/ResourceIcon.vue'
  import ConfirmDialog from '@/components/ConfirmDialog.vue'
  import DetailDialog from '@/components/DetailDialog.vue'
  import Sonner from '@/components/ui/sonner/Sonner.vue'
  import { MissionType } from '@/types/game'
  import type { BuildQueueItem, FleetMission } from '@/types/game'
  import { formatNumber, formatTime, getResourceColor } from '@/utils/format'
  import {
    Moon,
    Sun,
    Home,
    Building2,
    FlaskConical,
    Ship,
    Rocket,
    Shield,
    Mail,
    Globe,
    Users,
    Swords,
    Languages,
    Settings,
    Wrench,
    ChevronsLeft
  } from 'lucide-vue-next'
  import * as gameLogic from '@/logic/gameLogic'
  import * as planetLogic from '@/logic/planetLogic'
  import * as officerLogic from '@/logic/officerLogic'
  import * as buildingValidation from '@/logic/buildingValidation'
  import * as resourceLogic from '@/logic/resourceLogic'
  import * as researchValidation from '@/logic/researchValidation'
  import * as fleetLogic from '@/logic/fleetLogic'
  import * as shipLogic from '@/logic/shipLogic'
  import pkg from '../package.json'
  import { migrateGameData } from '@/utils/migration'

  // 执行数据迁移（在 store 初始化之前）
  migrateGameData()

  const gameStore = useGameStore()
  const universeStore = useUniverseStore()
  const { isDark } = useTheme()
  const { t } = useI18n()
  const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

  // 所有可用的语言选项
  const locales: Locale[] = ['zh-CN', 'zh-TW', 'en', 'de', 'ru', 'ko', 'ja']

  // 侧边栏状态（不持久化，根据屏幕尺寸初始化）
  // PC端（≥1024px）默认打开，移动端默认关闭
  const sidebarOpen = ref(window.innerWidth >= 1024)

  const initGame = async () => {
    const shouldInit = gameLogic.shouldInitializeGame(gameStore.player.planets)
    if (!shouldInit) {
      const now = Date.now()

      // 计算离线收益（直接同步计算）
      const bonuses = officerLogic.calculateActiveBonuses(gameStore.player.officers, now)
      gameStore.player.planets.forEach(planet => {
        resourceLogic.updatePlanetResources(planet, now, bonuses)
      })

      generateNPCPlanets()
      return
    }
    gameStore.player = gameLogic.initializePlayer(gameStore.player.id, t('common.playerName'))
    const initialPlanet = planetLogic.createInitialPlanet(gameStore.player.id, t('planet.homePlanet'))
    gameStore.player.planets = [initialPlanet]
    gameStore.currentPlanetId = initialPlanet.id
  }

  const generateNPCPlanets = () => {
    const npcCount = 200
    for (let i = 0; i < npcCount; i++) {
      const position = gameLogic.generateRandomPosition()
      const key = gameLogic.generatePositionKey(position.galaxy, position.system, position.position)
      if (universeStore.planets[key]) continue
      const npcPlanet = planetLogic.createNPCPlanet(i, position, t('planet.planetPrefix'))
      universeStore.planets[key] = npcPlanet
    }
  }

  const updateGame = () => {
    if (gameStore.isPaused) return
    const now = Date.now()
    gameStore.gameTime = now
    // 检查军官过期
    gameLogic.checkOfficersExpiration(gameStore.player.officers, now)
    // 处理游戏更新（建造队列、研究队列等）
    const result = gameLogic.processGameUpdate(gameStore.player, now)
    gameStore.player.researchQueue = result.updatedResearchQueue
    // 处理舰队任务
    gameStore.player.fleetMissions.forEach(mission => {
      if (mission.status === 'outbound' && now >= mission.arrivalTime) {
        processMissionArrival(mission)
      } else if (mission.status === 'returning' && mission.returnTime && now >= mission.returnTime) {
        processMissionReturn(mission)
      }
    })
  }

  const processMissionArrival = async (mission: FleetMission) => {
    // 从宇宙星球地图中查找目标星球
    const targetKey = gameLogic.generatePositionKey(
      mission.targetPosition.galaxy,
      mission.targetPosition.system,
      mission.targetPosition.position
    )
    // 先从玩家星球中查找，再从宇宙地图中查找
    const targetPlanet =
      gameStore.player.planets.find(
        p =>
          p.position.galaxy === mission.targetPosition.galaxy &&
          p.position.system === mission.targetPosition.system &&
          p.position.position === mission.targetPosition.position
      ) || universeStore.planets[targetKey]

    if (mission.missionType === MissionType.Transport) {
      fleetLogic.processTransportArrival(mission, targetPlanet)
    } else if (mission.missionType === MissionType.Attack) {
      const attackResult = await fleetLogic.processAttackArrival(mission, targetPlanet, gameStore.player, null, gameStore.player.planets)
      if (attackResult) {
        gameStore.player.battleReports.push(attackResult.battleResult)
        if (attackResult.moon) {
          gameStore.player.planets.push(attackResult.moon)
        }
        if (attackResult.debrisField) {
          // 将残骸场添加到游戏状态
          universeStore.debrisFields[attackResult.debrisField.id] = attackResult.debrisField
        }
      }
    } else if (mission.missionType === MissionType.Colonize) {
      const newPlanet = fleetLogic.processColonizeArrival(mission, targetPlanet, gameStore.player.id, t('planet.colonyPrefix'))
      if (newPlanet) {
        gameStore.player.planets.push(newPlanet)
      }
    } else if (mission.missionType === MissionType.Spy) {
      const spyReport = fleetLogic.processSpyArrival(mission, targetPlanet, gameStore.player.id)
      if (spyReport) gameStore.player.spyReports.push(spyReport)
    } else if (mission.missionType === MissionType.Deploy) {
      const deployed = fleetLogic.processDeployArrival(mission, targetPlanet, gameStore.player.id)
      if (deployed) {
        const missionIndex = gameStore.player.fleetMissions.indexOf(mission)
        if (missionIndex > -1) gameStore.player.fleetMissions.splice(missionIndex, 1)
        return
      }
    } else if (mission.missionType === MissionType.Recycle) {
      // 处理回收任务
      const debrisId = `debris_${mission.targetPosition.galaxy}_${mission.targetPosition.system}_${mission.targetPosition.position}`
      const debrisField = universeStore.debrisFields[debrisId]
      const recycleResult = fleetLogic.processRecycleArrival(mission, debrisField)
      if (recycleResult && debrisField) {
        if (recycleResult.remainingDebris && (recycleResult.remainingDebris.metal > 0 || recycleResult.remainingDebris.crystal > 0)) {
          // 更新残骸场
          universeStore.debrisFields[debrisId] = {
            id: debrisField.id,
            position: debrisField.position,
            resources: recycleResult.remainingDebris,
            createdAt: debrisField.createdAt,
            expiresAt: debrisField.expiresAt
          }
        } else {
          // 残骸场已被完全收集，删除
          delete universeStore.debrisFields[debrisId]
        }
      }
    } else if (mission.missionType === MissionType.Destroy) {
      // 处理行星毁灭任务
      const destroyResult = fleetLogic.processDestroyArrival(mission, targetPlanet, gameStore.player)
      if (destroyResult && destroyResult.success && destroyResult.planetId) {
        // 星球被摧毁
        // 从玩家星球列表中移除（如果是玩家的星球）
        const planetIndex = gameStore.player.planets.findIndex(p => p.id === destroyResult.planetId)
        if (planetIndex > -1) {
          gameStore.player.planets.splice(planetIndex, 1)
        } else {
          // 不是玩家星球，从宇宙地图中移除
          delete universeStore.planets[targetKey]
        }

        // TODO: 可以添加战斗报告或摧毁报告来通知玩家结果
      }
    }
  }

  const processMissionReturn = (mission: FleetMission) => {
    const originPlanet = gameStore.player.planets.find(p => p.id === mission.originPlanetId)
    if (!originPlanet) return
    shipLogic.addFleet(originPlanet.fleet, mission.fleet)
    resourceLogic.addResources(originPlanet.resources, mission.cargo)
    const missionIndex = gameStore.player.fleetMissions.indexOf(mission)
    if (missionIndex > -1) gameStore.player.fleetMissions.splice(missionIndex, 1)
  }

  // 游戏循环定时器
  let gameLoop: ReturnType<typeof setInterval> | null = null

  // 清理定时器
  onUnmounted(() => {
    if (gameLoop) clearInterval(gameLoop)
  })

  // 初始化游戏
  onMounted(async () => {
    // 如果是首次访问（没有星球数据），使用浏览器语言自动检测
    const isFirstVisit = gameStore.player.planets.length === 0
    if (isFirstVisit) {
      gameStore.locale = detectBrowserLocale()
    }
    await initGame()
    // 启动游戏循环
    gameLoop = setInterval(() => {
      updateGame()
    }, 1000) // 每1秒更新一次
  })

  // 定义 planet computed（需要在 watch 之前定义）
  const planet = computed(() => gameStore.currentPlanet)

  const navItems = [
    { name: computed(() => t('nav.overview')), path: '/', icon: Home },
    { name: computed(() => t('nav.buildings')), path: '/buildings', icon: Building2 },
    { name: computed(() => t('nav.research')), path: '/research', icon: FlaskConical },
    { name: computed(() => t('nav.shipyard')), path: '/shipyard', icon: Ship },
    { name: computed(() => t('nav.defense')), path: '/defense', icon: Shield },
    { name: computed(() => t('nav.fleet')), path: '/fleet', icon: Rocket },
    { name: computed(() => t('nav.officers')), path: '/officers', icon: Users },
    { name: computed(() => t('nav.simulator')), path: '/battle-simulator', icon: Swords },
    { name: computed(() => t('nav.galaxy')), path: '/galaxy', icon: Globe },
    { name: computed(() => t('nav.messages')), path: '/messages', icon: Mail },
    { name: computed(() => t('nav.settings')), path: '/settings', icon: Settings },
    // GM菜单仅在开发模式下显示
    ...(import.meta.env.DEV ? [{ name: computed(() => t('nav.gm')), path: '/gm', icon: Wrench }] : [])
  ]

  // 使用直接计算，不再缓存
  const production = computed(() => {
    if (!planet.value) return null
    const now = Date.now()
    const bonuses = officerLogic.calculateActiveBonuses(gameStore.player.officers, now)
    return resourceLogic.calculateResourceProduction(planet.value, {
      resourceProductionBonus: bonuses.resourceProductionBonus,
      darkMatterProductionBonus: bonuses.darkMatterProductionBonus,
      energyProductionBonus: bonuses.energyProductionBonus
    })
  })

  const capacity = computed(() => {
    if (!planet.value) return null
    const now = Date.now()
    const bonuses = officerLogic.calculateActiveBonuses(gameStore.player.officers, now)
    return resourceLogic.calculateResourceCapacity(planet.value, bonuses.storageCapacityBonus)
  })

  // 未读消息数量
  const unreadMessagesCount = computed(() => {
    const unreadBattles = gameStore.player.battleReports.filter(r => !r.read).length
    const unreadSpies = gameStore.player.spyReports.filter(r => !r.read).length
    return unreadBattles + unreadSpies
  })

  // 资源类型配置
  const resourceTypes = [
    { key: 'metal' as const },
    { key: 'crystal' as const },
    { key: 'deuterium' as const },
    { key: 'energy' as const },
    { key: 'darkMatter' as const }
  ]

  // 月球相关
  const moon = computed(() => {
    if (!planet.value || planet.value.isMoon) return null
    return gameStore.getMoonForPlanet(planet.value.id)
  })
  const hasMoon = computed(() => !!moon.value)

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

  // 切换侧边栏
  const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value
  }

  // 获取队列项的名称
  const getItemName = (item: BuildQueueItem): string => {
    if (item.type === 'building' || item.type === 'demolish') {
      const buildingName = t(`buildings.${item.itemType}`)
      return item.type === 'demolish' ? `${t('buildingsView.demolish')} - ${buildingName}` : buildingName
    } else if (item.type === 'technology') {
      return t(`technologies.${item.itemType}`)
    } else if (item.type === 'ship') {
      return t(`ships.${item.itemType}`)
    } else if (item.type === 'defense') {
      return t(`defenses.${item.itemType}`)
    }
    return item.itemType
  }

  // 获取剩余时间
  const getRemainingTime = (item: BuildQueueItem): number => {
    const now = Date.now()
    return Math.max(0, Math.floor((item.endTime - now) / 1000))
  }

  // 获取队列进度
  const getQueueProgress = (item: BuildQueueItem): number => {
    const now = Date.now()
    const total = item.endTime - item.startTime
    const elapsed = now - item.startTime
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }

  // 取消建造
  const handleCancelBuild = (queueId: string) => {
    confirmDialog.value?.show({
      title: t('queue.cancelBuild'),
      message: t('queue.confirmCancel'),
      onConfirm: () => {
        if (!gameStore.currentPlanet) return false
        const { item, index } = buildingValidation.findQueueItem(gameStore.currentPlanet.buildQueue, queueId)
        if (!item) return false
        if (item.type === 'building') {
          const refund = buildingValidation.cancelBuildingUpgrade(gameStore.currentPlanet, item)
          resourceLogic.addResources(gameStore.currentPlanet.resources, refund)
        }
        gameStore.currentPlanet.buildQueue.splice(index, 1)
        return true
      }
    })
  }

  // 取消研究
  const handleCancelResearch = (queueId: string) => {
    confirmDialog.value?.show({
      title: t('queue.cancelResearch'),
      message: t('queue.confirmCancel'),
      onConfirm: () => {
        if (!gameStore.currentPlanet) return false
        const { item, index } = buildingValidation.findQueueItem(gameStore.player.researchQueue, queueId)
        if (!item) return false
        if (item.type === 'technology') {
          const refund = researchValidation.cancelTechnologyResearch(item)
          resourceLogic.addResources(gameStore.currentPlanet.resources, refund)
        }
        gameStore.player.researchQueue.splice(index, 1)
        return true
      }
    })
  }
</script>

<style scoped>
  /* 平滑滚动 */
  main {
    scroll-behavior: smooth;
  }
</style>
