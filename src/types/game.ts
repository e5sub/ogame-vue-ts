// 资源类型
export interface Resources {
  metal: number
  crystal: number
  deuterium: number
  darkMatter: number // 暗物质
  energy: number // 电量（实时计算，不存储）
}

// 建筑类型
export const BuildingType = {
  MetalMine: 'metalMine',
  CrystalMine: 'crystalMine',
  DeuteriumSynthesizer: 'deuteriumSynthesizer',
  SolarPlant: 'solarPlant',
  RoboticsFactory: 'roboticsFactory',
  NaniteFactory: 'naniteFactory', // 纳米工厂
  Shipyard: 'shipyard',
  ResearchLab: 'researchLab',
  MetalStorage: 'metalStorage',
  CrystalStorage: 'crystalStorage',
  DeuteriumTank: 'deuteriumTank',
  DarkMatterCollector: 'darkMatterCollector', // 暗物质收集器
  Terraformer: 'terraformer', // 地形改造器
  // 月球专属建筑
  LunarBase: 'lunarBase', // 月球基地
  SensorPhalanx: 'sensorPhalanx', // 传感器阵列
  JumpGate: 'jumpGate', // 跳跃门
  // 特殊建筑
  PlanetDestroyerFactory: 'planetDestroyerFactory' // 行星毁灭者工厂
} as const

export type BuildingType = (typeof BuildingType)[keyof typeof BuildingType]

// 建筑配置
export interface BuildingConfig {
  id: BuildingType
  name: string
  description: string
  baseCost: Resources
  baseTime: number // 基础建造时间(秒)
  costMultiplier: number // 升级成本倍数
  spaceUsage: number // 占用空间
  fleetStorageBonus?: number // 每级增加的舰队仓储（可选）
  planetOnly?: boolean // 仅行星可建造
  moonOnly?: boolean // 仅月球可建造
  maxLevel?: number // 最大等级（可选，不设置则无上限）
  requirements?: Partial<Record<BuildingType | TechnologyType, number>> // 前置条件（初始解锁）
  levelRequirements?: Record<number, Partial<Record<BuildingType | TechnologyType, number>>> // 等级升级条件
}

// 建筑实例
export interface Building {
  type: BuildingType
  level: number
}

// 研究科技类型
export const TechnologyType = {
  EnergyTechnology: 'energyTechnology',
  LaserTechnology: 'laserTechnology',
  IonTechnology: 'ionTechnology',
  HyperspaceTechnology: 'hyperspaceTechnology',
  PlasmaTechnology: 'plasmaTechnology',
  ComputerTechnology: 'computerTechnology', // 计算机技术
  CombustionDrive: 'combustionDrive',
  ImpulseDrive: 'impulseDrive',
  HyperspaceDrive: 'hyperspaceDrive',
  DarkMatterTechnology: 'darkMatterTechnology', // 暗物质技术
  TerraformingTechnology: 'terraformingTechnology', // 地形改造技术
  PlanetDestructionTech: 'planetDestructionTech' // 行星毁灭技术
} as const

export type TechnologyType = (typeof TechnologyType)[keyof typeof TechnologyType]

// 科技配置
export interface TechnologyConfig {
  id: TechnologyType
  name: string
  description: string
  baseCost: Resources
  baseTime: number
  costMultiplier: number
  fleetStorageBonus?: number // 每级增加的舰队仓储（全局，可选）
  maxLevel?: number // 最大等级（可选，不设置则无上限）
  requirements?: Partial<Record<BuildingType | TechnologyType, number>> // 前置条件（初始解锁）
  levelRequirements?: Record<number, Partial<Record<BuildingType | TechnologyType, number>>> // 等级升级条件
}

// 科技实例
export interface Technology {
  type: TechnologyType
  level: number
}

// 防御设施类型
export const DefenseType = {
  RocketLauncher: 'rocketLauncher',
  LightLaser: 'lightLaser',
  HeavyLaser: 'heavyLaser',
  GaussCannon: 'gaussCannon',
  IonCannon: 'ionCannon',
  PlasmaTurret: 'plasmaTurret',
  SmallShieldDome: 'smallShieldDome',
  LargeShieldDome: 'largeShieldDome',
  PlanetaryShield: 'planetaryShield' // 行星护盾
} as const

export type DefenseType = (typeof DefenseType)[keyof typeof DefenseType]

// 防御设施配置
export interface DefenseConfig {
  id: DefenseType
  name: string
  description: string
  cost: Resources
  buildTime: number
  attack: number
  shield: number
  armor: number
  requirements?: Partial<Record<BuildingType | TechnologyType, number>>
}

// 舰船类型
export const ShipType = {
  LightFighter: 'lightFighter',
  HeavyFighter: 'heavyFighter',
  Cruiser: 'cruiser',
  Battleship: 'battleship',
  SmallCargo: 'smallCargo',
  LargeCargo: 'largeCargo',
  ColonyShip: 'colonyShip',
  Recycler: 'recycler',
  EspionageProbe: 'espionageProbe',
  DarkMatterHarvester: 'darkMatterHarvester', // 暗物质采集船
  Deathstar: 'deathstar' // 死星
} as const

export type ShipType = (typeof ShipType)[keyof typeof ShipType]

// 舰船配置
export interface ShipConfig {
  id: ShipType
  name: string
  description: string
  cost: Resources
  buildTime: number
  cargoCapacity: number
  attack: number
  shield: number
  armor: number
  speed: number
  fuelConsumption: number
  storageUsage: number // 占用舰队仓储
  requirements?: Partial<Record<BuildingType | TechnologyType, number>>
}

// 舰船实例
export interface Fleet {
  [ShipType.LightFighter]: number
  [ShipType.HeavyFighter]: number
  [ShipType.Cruiser]: number
  [ShipType.Battleship]: number
  [ShipType.SmallCargo]: number
  [ShipType.LargeCargo]: number
  [ShipType.ColonyShip]: number
  [ShipType.Recycler]: number
  [ShipType.EspionageProbe]: number
  [ShipType.DarkMatterHarvester]: number
  [ShipType.Deathstar]: number
}

// 舰队任务类型
export const MissionType = {
  Attack: 'attack',
  Transport: 'transport',
  Colonize: 'colonize',
  Spy: 'spy',
  Deploy: 'deploy',
  Expedition: 'expedition',
  HarvestDarkMatter: 'harvestDarkMatter', // 暗物质采集
  Recycle: 'recycle', // 回收残骸
  Destroy: 'destroy' // 行星毁灭
} as const

export type MissionType = (typeof MissionType)[keyof typeof MissionType]

// 舰队任务
export interface FleetMission {
  id: string
  playerId: string
  originPlanetId: string
  targetPosition: { galaxy: number; system: number; position: number }
  targetPlanetId?: string
  missionType: MissionType
  fleet: Partial<Fleet>
  cargo: Resources
  departureTime: number
  arrivalTime: number
  returnTime?: number
  status: 'outbound' | 'returning' | 'arrived'
}

// 战斗结果
export interface BattleResult {
  id: string
  timestamp: number
  attackerId: string
  defenderId: string
  attackerPlanetId: string
  defenderPlanetId: string
  attackerFleet: Partial<Fleet>
  defenderFleet: Partial<Fleet>
  defenderDefense: Partial<Record<DefenseType, number>>
  attackerLosses: Partial<Fleet>
  defenderLosses: {
    fleet: Partial<Fleet>
    defense: Partial<Record<DefenseType, number>>
  }
  winner: 'attacker' | 'defender' | 'draw'
  read?: boolean // 已读状态
  plunder: Resources
  debrisField: Resources
  // 新增详细信息
  rounds?: number
  attackerRemaining?: Partial<Fleet>
  defenderRemaining?: {
    fleet: Partial<Fleet>
    defense: Partial<Record<DefenseType, number>>
  }
  roundDetails?: Array<{
    round: number
    attackerLosses: Partial<Fleet>
    defenderLosses: {
      fleet: Partial<Fleet>
      defense: Partial<Record<DefenseType, number>>
    }
    attackerRemainingPower: number
    defenderRemainingPower: number
  }>
  moonChance?: number // 月球生成概率
}

// 间谍报告
export interface SpyReport {
  id: string
  timestamp: number
  spyId: string
  targetPlanetId: string
  targetPlayerId: string
  resources: Resources
  fleet?: Partial<Fleet>
  defense?: Partial<Record<DefenseType, number>>
  buildings?: Partial<Record<BuildingType, number>>
  technologies?: Partial<Record<TechnologyType, number>>
  detectionChance: number
  read?: boolean // 已读状态
}

// 残骸场
export interface DebrisField {
  id: string
  position: { galaxy: number; system: number; position: number }
  resources: Pick<Resources, 'metal' | 'crystal'> // 残骸场只包含金属和晶体
  createdAt: number
  expiresAt?: number // 可选的过期时间
}

// 建造队列项
export interface BuildQueueItem {
  id: string
  type: 'building' | 'technology' | 'ship' | 'defense' | 'demolish'
  itemType: BuildingType | TechnologyType | ShipType | DefenseType
  targetLevel?: number // 用于建筑和科技
  quantity?: number // 用于舰船和防御
  startTime: number
  endTime: number
}

// 星球
export interface Planet {
  id: string
  name: string
  ownerId?: string
  position: { galaxy: number; system: number; position: number }
  resources: Resources
  buildings: Record<BuildingType, number>
  fleet: Fleet
  defense: Record<DefenseType, number>
  buildQueue: BuildQueueItem[]
  lastUpdate: number
  maxSpace: number // 最大空间
  maxFleetStorage: number // 舰队仓储上限
  isMoon: boolean // 是否为月球
  parentPlanetId?: string // 如果是月球,指向母星的ID
}

// 月球特殊配置
export interface MoonConfig {
  minDebrisField: number // 生成月球所需的最小残骸场
  baseChance: number // 基础生成概率
  maxChance: number // 最大生成概率
  chancePerDebris: number // 每单位残骸增加的概率
}

// 军官类型
export const OfficerType = {
  Commander: 'commander', // 指挥官 - 增加建筑队列
  Admiral: 'admiral', // 上将 - 增加舰队槽位
  Engineer: 'engineer', // 工程师 - 增加防御和能量
  Geologist: 'geologist', // 地质学家 - 增加资源产量
  Technocrat: 'technocrat', // 技术专家 - 减少研究时间
  DarkMatterSpecialist: 'darkMatterSpecialist' // 暗物质专家 - 增加暗物质产量
} as const

export type OfficerType = (typeof OfficerType)[keyof typeof OfficerType]

// 军官配置
export interface OfficerConfig {
  id: OfficerType
  name: string
  description: string
  cost: Resources // 招募成本
  weeklyMaintenance: Resources // 每周维护费用
  benefits: {
    buildingSpeedBonus?: number // 建筑速度加成 (百分比)
    researchSpeedBonus?: number // 研究速度加成 (百分比)
    resourceProductionBonus?: number // 资源产量加成 (百分比)
    darkMatterProductionBonus?: number // 暗物质产量加成 (百分比)
    energyProductionBonus?: number // 电量产出加成 (百分比)
    fleetSpeedBonus?: number // 舰队速度加成 (百分比)
    fuelConsumptionReduction?: number // 燃料消耗减少 (百分比)
    defenseBonus?: number // 防御加成 (百分比)
    additionalBuildQueue?: number // 额外建筑队列
    additionalFleetSlots?: number // 额外舰队槽位
    storageCapacityBonus?: number // 仓储容量加成 (百分比)
  }
}

// 军官实例
export interface Officer {
  type: OfficerType
  active: boolean
  hiredAt?: number // 招募时间
  expiresAt?: number // 到期时间
}

// 玩家
export interface Player {
  id: string
  name: string
  planets: Planet[]
  technologies: Record<TechnologyType, number>
  officers: Record<OfficerType, Officer>
  researchQueue: BuildQueueItem[]
  fleetMissions: FleetMission[]
  battleReports: BattleResult[]
  spyReports: SpyReport[]
  points: number // 总积分（每1000资源=1分）
}

// 游戏状态
export interface GameState {
  player: Player
  currentPlanetId: string
  gameTime: number
  isPaused: boolean
  universe: Universe
}

// 宇宙
export interface Universe {
  galaxies: number
  systems: number
  positions: number
  planets: Map<string, Planet> // key: "galaxy:system:position"
  npcs: NPC[]
}

// NPC玩家
export interface NPC {
  id: string
  name: string
  planets: Planet[]
  technologies: Record<TechnologyType, number>
  difficulty: 'easy' | 'medium' | 'hard'
}
