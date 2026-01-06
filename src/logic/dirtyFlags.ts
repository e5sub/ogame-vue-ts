/**
 * 脏标志系统
 * 用于性能优化，追踪哪些子系统需要处理
 * 当标志为 false 时，对应的引擎可以跳过重计算
 */

/**
 * 脏标志接口，用于追踪游戏子系统是否需要更新
 */
export interface DirtyFlags {
  /** 经济计算需要更新（资源生产、存储） */
  economyDirty: boolean
  /** 舰队/任务需要处理（有活动任务） */
  fleetDirty: boolean
  /** NPC行为需要更新 */
  npcDirty: boolean
  /** 建造/研究队列需要处理 */
  queuesDirty: boolean
}

/**
 * 创建新的脏标志实例，所有标志设为 true（强制初始处理）
 */
export const createDirtyFlags = (): DirtyFlags => ({
  economyDirty: true,
  fleetDirty: true,
  npcDirty: true,
  queuesDirty: true
})

/**
 * 重置所有脏标志为 false（干净状态）
 */
export const resetDirtyFlags = (flags: DirtyFlags): void => {
  flags.economyDirty = false
  flags.fleetDirty = false
  flags.npcDirty = false
  flags.queuesDirty = false
}

/**
 * 标记经济为脏（需要重新计算）
 * 调用时机：资源变化、建筑完成、星球状态变化
 */
export const markEconomyDirty = (flags: DirtyFlags): void => {
  flags.economyDirty = true
}

/**
 * 标记舰队为脏（需要处理）
 * 调用时机：新任务发送、任务到达、舰队组成变化
 */
export const markFleetDirty = (flags: DirtyFlags): void => {
  flags.fleetDirty = true
}

/**
 * 标记NPC为脏（需要行为更新）
 * 调用时机：NPC状态变化、玩家-NPC交互、基于时间的NPC事件
 */
export const markNpcDirty = (flags: DirtyFlags): void => {
  flags.npcDirty = true
}

/**
 * 标记队列为脏（需要处理）
 * 调用时机：新项目入队、队列项目完成、队列取消
 */
export const markQueuesDirty = (flags: DirtyFlags): void => {
  flags.queuesDirty = true
}

/**
 * 标记所有标志为脏（强制完整处理）
 * 调用时机：游戏加载、重大状态变化、时间跳跃
 */
export const markAllDirty = (flags: DirtyFlags): void => {
  flags.economyDirty = true
  flags.fleetDirty = true
  flags.npcDirty = true
  flags.queuesDirty = true
}
