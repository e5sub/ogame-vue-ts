import { encryptData, decryptData } from '@/utils/crypto'
import { useGameStore } from '@/stores/gameStore'
import { useUniverseStore } from '@/stores/universeStore'
import { useNPCStore } from '@/stores/npcStore'
import pkg from '../../package.json'

/**
 * 存档信封类型
 * 包含版本号、创建时间和加密数据
 */
export type SaveEnvelope = {
  version: number
  createdAt: number
  data: any
}

/**
 * 存档数据载荷类型
 */
type SavePayload = {
  game: any
  universe?: any | null
  npcs?: any | null
}

/**
 * 存档系统接口
 */
export interface SaveSystem {
  /** 从 localStorage 加载存档 */
  load(): Promise<void>
  /** 保存到 localStorage */
  save(): Promise<void>
  /** 导出存档为字符串 */
  exportSave(): string
  /** 从字符串导入存档 */
  importSave(payload: string): Promise<void>
}

/** 当前存档版本号（从 package.json 版本号派生，如 1.6.0 → 160） */
const CURRENT_SAVE_VERSION = parseInt(pkg.version.replace(/\./g, ''), 10) || 1

/** 默认存档键名 */
const DEFAULT_SAVE_KEY = `${pkg.name}-save`

/**
 * 迁移函数映射
 * 键为源版本号，值为迁移函数
 * 示例：{ 1: (d) => migrateV1ToV2(d) }
 */
const migrations: Record<number, (payload: SavePayload) => SavePayload> = {
  // 未来迁移示例：
  // 1: (payload) => {
  //   // 从 v1 迁移到 v2
  //   return { ...payload, game: { ...payload.game, newField: 'default' } }
  // }
}

/**
 * 检查是否为有效的 SaveEnvelope
 */
const isSaveEnvelope = (value: unknown): value is SaveEnvelope => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return typeof obj.version === 'number' && typeof obj.createdAt === 'number' && 'data' in obj
}

/**
 * 检查是否为 GameStore 状态结构
 */
const isLikelyGameStoreState = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return 'player' in obj && 'locale' in obj
}

/**
 * 构建存档信封
 */
const buildEnvelope = (payload: SavePayload): SaveEnvelope => ({
  version: CURRENT_SAVE_VERSION,
  createdAt: Date.now(),
  data: encryptData(payload)
})

/**
 * 应用迁移
 * 从当前版本逐步迁移到最新版本
 */
const applyMigrations = (version: number, payload: SavePayload): SavePayload => {
  if (version > CURRENT_SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${version}`)
  }

  let migrated = payload
  for (let v = version; v < CURRENT_SAVE_VERSION; v++) {
    const migrationFn = migrations[v]
    if (migrationFn) {
      migrated = migrationFn(migrated)
    }
  }

  return migrated
}

/**
 * 规范化导入的存档数据
 * 支持新格式（SaveEnvelope）和旧格式（直接加密数据）
 */
const normalizeImportedPayload = (raw: string): { version: number; payload: SavePayload } => {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('Empty payload')

  // 尝试解析为 JSON
  let parsed: unknown = null
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    parsed = null
  }

  // 1) 新格式：JSON SaveEnvelope
  if (isSaveEnvelope(parsed)) {
    const decrypted = typeof parsed.data === 'string' ? decryptData(parsed.data) : typeof parsed.data === 'object' ? parsed.data : null

    if (!decrypted || typeof decrypted !== 'object' || !('game' in decrypted)) {
      throw new Error('Invalid save payload')
    }
    return { version: parsed.version, payload: decrypted as SavePayload }
  }

  // 2) 旧格式：{ game: <cipher>, universe: <cipher|null>, npcs: <cipher|null> }
  if (parsed && typeof parsed === 'object' && 'game' in parsed) {
    const legacyParsed = parsed as Record<string, unknown>
    const gameState = typeof legacyParsed.game === 'string' ? decryptData(legacyParsed.game) : null
    if (!gameState) throw new Error('Invalid legacy save payload')

    const universeState = typeof legacyParsed.universe === 'string' ? decryptData(legacyParsed.universe) : null
    const npcsState =
      typeof (legacyParsed.npcs ?? legacyParsed.npc) === 'string' ? decryptData((legacyParsed.npcs ?? legacyParsed.npc) as string) : null

    return {
      version: 0,
      payload: {
        game: gameState,
        universe: universeState,
        npcs: npcsState
      }
    }
  }

  // 3) 最旧格式：直接是加密字符串
  if (typeof parsed === 'string') {
    const gameState = decryptData(parsed)
    if (!gameState) throw new Error('Invalid save payload')
    return { version: 0, payload: { game: gameState } }
  }

  // 4) 原始加密字符串（非 JSON）
  const decrypted = decryptData(trimmed)
  if (decrypted && typeof decrypted === 'object') {
    if ('game' in decrypted) {
      return { version: 0, payload: decrypted as SavePayload }
    }
    if (isLikelyGameStoreState(decrypted)) {
      return { version: 0, payload: { game: decrypted } }
    }
  }

  // 5) 纯 JSON GameStore 状态
  if (parsed && isLikelyGameStoreState(parsed)) {
    return { version: 0, payload: { game: parsed } }
  }

  throw new Error('Unsupported save format')
}

/**
 * 创建存档系统
 */
export const createSaveSystem = (): SaveSystem => {
  let gameStore: ReturnType<typeof useGameStore> | null = null
  let universeStore: ReturnType<typeof useUniverseStore> | null = null
  let npcStore: ReturnType<typeof useNPCStore> | null = null

  /** 延迟获取 Store 引用 */
  const getStores = () => {
    if (!gameStore) gameStore = useGameStore()
    if (!universeStore) universeStore = useUniverseStore()
    if (!npcStore) npcStore = useNPCStore()
    return { gameStore, universeStore, npcStore }
  }

  /** 导出存档为字符串 */
  const exportSave = (): string => {
    const { gameStore, universeStore, npcStore } = getStores()
    const payload: SavePayload = {
      game: gameStore.$state,
      universe: universeStore.$state,
      npcs: npcStore.$state
    }
    return JSON.stringify(buildEnvelope(payload))
  }

  /** 从字符串导入存档 */
  const importSave = async (raw: string): Promise<void> => {
    const { version, payload } = normalizeImportedPayload(raw)
    const migrated = applyMigrations(version, payload)

    const { gameStore, universeStore, npcStore } = getStores()

    // 重置所有 Store
    gameStore.$reset()
    universeStore.$reset()
    npcStore.$reset()

    if (!migrated.game) throw new Error('Save payload missing game state')

    // 应用迁移后的数据
    gameStore.$patch(migrated.game)
    if (migrated.universe) universeStore.$patch(migrated.universe)
    if (migrated.npcs) npcStore.$patch(migrated.npcs)
  }

  /** 保存到 localStorage */
  const save = async (): Promise<void> => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(DEFAULT_SAVE_KEY, exportSave())
  }

  /** 从 localStorage 加载存档 */
  const load = async (): Promise<void> => {
    if (typeof localStorage === 'undefined') return
    const saved = localStorage.getItem(DEFAULT_SAVE_KEY)
    if (!saved) return
    await importSave(saved)
  }

  return {
    load,
    save,
    exportSave,
    importSave
  }
}
