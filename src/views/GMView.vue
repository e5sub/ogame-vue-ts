<template>
  <div class="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl sm:text-3xl font-bold">{{ t('gmView.title') }}</h1>
      <Badge variant="destructive">{{ t('gmView.adminOnly') }}</Badge>
    </div>

    <!-- 星球选择 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t('gmView.selectPlanet') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <Select v-model="selectedPlanetId">
          <SelectTrigger>
            <SelectValue :placeholder="t('gmView.choosePlanet')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="planet in gameStore.player.planets" :key="planet.id" :value="planet.id">
              {{ planet.name }} ({{ planet.position.galaxy }}:{{ planet.position.system }}:{{ planet.position.position }})
            </SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>

    <!-- 标签切换 -->
    <div v-if="selectedPlanet" class="flex flex-wrap gap-2 border-b">
      <Button @click="activeTab = 'resources'" :variant="activeTab === 'resources' ? 'default' : 'ghost'" class="rounded-b-none">
        {{ t('gmView.resources') }}
      </Button>
      <Button @click="activeTab = 'buildings'" :variant="activeTab === 'buildings' ? 'default' : 'ghost'" class="rounded-b-none">
        {{ t('gmView.buildings') }}
      </Button>
      <Button @click="activeTab = 'research'" :variant="activeTab === 'research' ? 'default' : 'ghost'" class="rounded-b-none">
        {{ t('gmView.research') }}
      </Button>
      <Button @click="activeTab = 'ships'" :variant="activeTab === 'ships' ? 'default' : 'ghost'" class="rounded-b-none">
        {{ t('gmView.ships') }}
      </Button>
      <Button @click="activeTab = 'defense'" :variant="activeTab === 'defense' ? 'default' : 'ghost'" class="rounded-b-none">
        {{ t('gmView.defense') }}
      </Button>
      <Button @click="activeTab = 'officers'" :variant="activeTab === 'officers' ? 'default' : 'ghost'" class="rounded-b-none">
        {{ t('gmView.officers') }}
      </Button>
    </div>

    <!-- 资源 -->
    <div v-if="selectedPlanet && activeTab === 'resources'" class="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('gmView.modifyResources') }}</CardTitle>
          <CardDescription>{{ t('gmView.resourcesDesc') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-for="resource in resourceTypes" :key="resource" class="space-y-2">
            <Label>{{ t(`resources.${resource}`) }}</Label>
            <div class="flex gap-2">
              <Input v-model.number="selectedPlanet.resources[resource]" type="number" min="0" class="flex-1" />
              <Button @click="setResourceAmount(resource, 1000000)" variant="outline" size="sm">+1M</Button>
              <Button @click="setResourceAmount(resource, 10000000)" variant="outline" size="sm">+10M</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 建筑 -->
    <div v-if="selectedPlanet && activeTab === 'buildings'" class="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('gmView.modifyBuildings') }}</CardTitle>
          <CardDescription>{{ t('gmView.buildingsDesc') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="building in buildingTypes" :key="building" class="space-y-2">
              <Label>{{ BUILDINGS[building].name }}</Label>
              <div class="flex gap-2">
                <Input v-model.number="selectedPlanet.buildings[building]" type="number" min="0" max="100" class="flex-1" />
                <Button @click="setBuildingLevel(building, 10)" variant="outline" size="sm">Lv 10</Button>
                <Button @click="setBuildingLevel(building, 30)" variant="outline" size="sm">Lv 30</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 科技 -->
    <div v-if="activeTab === 'research'" class="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('gmView.modifyResearch') }}</CardTitle>
          <CardDescription>{{ t('gmView.researchDesc') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="tech in technologyTypes" :key="tech" class="space-y-2">
              <Label>{{ TECHNOLOGIES[tech].name }}</Label>
              <div class="flex gap-2">
                <Input v-model.number="gameStore.player.technologies[tech]" type="number" min="0" max="50" class="flex-1" />
                <Button @click="setTechnologyLevel(tech, 10)" variant="outline" size="sm">Lv 10</Button>
                <Button @click="setTechnologyLevel(tech, 20)" variant="outline" size="sm">Lv 20</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 舰船 -->
    <div v-if="selectedPlanet && activeTab === 'ships'" class="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('gmView.modifyShips') }}</CardTitle>
          <CardDescription>{{ t('gmView.shipsDesc') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="ship in shipTypes" :key="ship" class="space-y-2">
              <Label>{{ SHIPS[ship].name }}</Label>
              <div class="flex gap-2">
                <Input v-model.number="selectedPlanet.fleet[ship]" type="number" min="0" class="flex-1" />
                <Button @click="setShipCount(ship, 100)" variant="outline" size="sm">+100</Button>
                <Button @click="setShipCount(ship, 1000)" variant="outline" size="sm">+1K</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 防御 -->
    <div v-if="selectedPlanet && activeTab === 'defense'" class="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('gmView.modifyDefense') }}</CardTitle>
          <CardDescription>{{ t('gmView.defenseDesc') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="defense in defenseTypes" :key="defense" class="space-y-2">
              <Label>{{ DEFENSES[defense].name }}</Label>
              <div class="flex gap-2">
                <Input v-model.number="selectedPlanet.defense[defense]" type="number" min="0" class="flex-1" />
                <Button @click="setDefenseCount(defense, 100)" variant="outline" size="sm">+100</Button>
                <Button @click="setDefenseCount(defense, 1000)" variant="outline" size="sm">+1K</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 军官 -->
    <div v-if="activeTab === 'officers'" class="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('gmView.modifyOfficers') }}</CardTitle>
          <CardDescription>{{ t('gmView.officersDesc') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="officer in officerTypes" :key="officer" class="space-y-2">
              <Label>{{ OFFICERS[officer].name }}</Label>
              <div class="flex gap-2">
                <Input v-model.number="officerDays[officer]" type="number" min="0" :placeholder="t('gmView.days')" class="flex-1" />
                <Button @click="setOfficerDays(officer, 7)" variant="outline" size="sm">7{{ t('gmView.days') }}</Button>
                <Button @click="setOfficerDays(officer, 30)" variant="outline" size="sm">30{{ t('gmView.days') }}</Button>
                <Button @click="setOfficerDays(officer, 365)" variant="outline" size="sm">365{{ t('gmView.days') }}</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 危险操作 -->
    <Card class="border-destructive">
      <CardHeader>
        <CardTitle class="text-destructive">{{ t('gmView.dangerZone') }}</CardTitle>
        <CardDescription>{{ t('gmView.dangerZoneDesc') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-2">
        <Button @click="resetGame" variant="destructive" class="w-full">{{ t('gmView.resetGame') }}</Button>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useGameStore } from '@/stores/gameStore'
  import { useI18n } from '@/composables/useI18n'
  import { useGameConfig } from '@/composables/useGameConfig'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Label } from '@/components/ui/label'
  import { Badge } from '@/components/ui/badge'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
  import { BuildingType, TechnologyType, ShipType, DefenseType, OfficerType } from '@/types/game'

  const gameStore = useGameStore()
  const { t } = useI18n()
  const { BUILDINGS, TECHNOLOGIES, SHIPS, DEFENSES, OFFICERS } = useGameConfig()

  const selectedPlanetId = ref<string>(gameStore.player.planets[0]?.id || '')
  const activeTab = ref<'resources' | 'buildings' | 'research' | 'ships' | 'defense' | 'officers'>('resources')
  const officerDays = ref<Record<OfficerType, number>>({} as Record<OfficerType, number>)

  // 初始化军官天数显示
  Object.values(OfficerType).forEach(officer => {
    const officerData = gameStore.player.officers[officer]
    if (officerData && officerData.expiresAt) {
      const daysLeft = Math.ceil((officerData.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
      officerDays.value[officer] = Math.max(0, daysLeft)
    } else {
      officerDays.value[officer] = 0
    }
  })

  const selectedPlanet = computed(() => {
    return gameStore.player.planets.find(p => p.id === selectedPlanetId.value)
  })

  const resourceTypes = ['metal', 'crystal', 'deuterium', 'darkMatter'] as const
  const buildingTypes = Object.values(BuildingType)
  const technologyTypes = Object.values(TechnologyType)
  const shipTypes = Object.values(ShipType)
  const defenseTypes = Object.values(DefenseType)
  const officerTypes = Object.values(OfficerType)

  const setResourceAmount = (resource: string, amount: number) => {
    if (selectedPlanet.value) {
      selectedPlanet.value.resources[resource as keyof typeof selectedPlanet.value.resources] += amount
    }
  }

  const setBuildingLevel = (building: BuildingType, level: number) => {
    if (selectedPlanet.value) {
      selectedPlanet.value.buildings[building] = level
    }
  }

  const setTechnologyLevel = (tech: TechnologyType, level: number) => {
    gameStore.player.technologies[tech] = level
  }

  const setShipCount = (ship: ShipType, count: number) => {
    if (selectedPlanet.value) {
      selectedPlanet.value.fleet[ship] = (selectedPlanet.value.fleet[ship] || 0) + count
    }
  }

  const setDefenseCount = (defense: DefenseType, count: number) => {
    if (selectedPlanet.value) {
      selectedPlanet.value.defense[defense] = (selectedPlanet.value.defense[defense] || 0) + count
    }
  }

  const setOfficerDays = (officer: OfficerType, days: number) => {
    officerDays.value[officer] = days
    const now = Date.now()
    const expiresAt = now + days * 24 * 60 * 60 * 1000

    if (!gameStore.player.officers[officer]) {
      gameStore.player.officers[officer] = {
        type: officer,
        active: true,
        hiredAt: now,
        expiresAt: expiresAt
      }
    } else {
      gameStore.player.officers[officer].expiresAt = expiresAt
      gameStore.player.officers[officer].active = true
      if (!gameStore.player.officers[officer].hiredAt) {
        gameStore.player.officers[officer].hiredAt = now
      }
    }
  }

  const resetGame = () => {
    if (confirm(t('gmView.resetGameConfirm'))) {
      localStorage.clear()
      location.reload()
    }
  }
</script>
