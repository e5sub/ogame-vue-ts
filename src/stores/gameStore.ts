import { defineStore } from 'pinia'
import type { Planet, Player, BuildQueueItem, FleetMission, BattleResult, SpyReport, Officer } from '@/types/game'
import { TechnologyType, OfficerType } from '@/types/game'
import type { Locale } from '@/locales'
import pkg from '../../package.json'
import { encryptData, decryptData } from '@/utils/crypto'

export const useGameStore = defineStore('game', {
  state: () => ({
    gameTime: Date.now(),
    isPaused: false,
    player: {
      id: 'player1',
      name: '',
      planets: [] as Planet[],
      technologies: {} as Record<TechnologyType, number>,
      officers: {} as Record<OfficerType, Officer>,
      researchQueue: [] as BuildQueueItem[],
      fleetMissions: [] as FleetMission[],
      battleReports: [] as BattleResult[],
      spyReports: [] as SpyReport[]
    } as Player,
    currentPlanetId: '',
    isDark: '',
    locale: 'zh-CN' as Locale
  }),
  getters: {
    currentPlanet(): Planet | undefined {
      return this.player.planets.find(p => p.id === this.currentPlanetId)
    },
    getMoonForPlanet(): (planetId: string) => Planet | undefined {
      return (planetId: string) => {
        return this.player.planets.find(p => p.parentPlanetId === planetId && p.isMoon)
      }
    }
  },
  persist: {
    key: pkg.name,
    storage: localStorage,
    serializer: {
      serialize: state => encryptData(state),
      deserialize: value => decryptData(value)
    }
  }
})
