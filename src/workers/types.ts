/**
 * Worker 通用类型定义
 * 统一的请求/响应格式
 */

/**
 * Worker 请求消息
 * @template T - payload 类型
 */
export interface WorkerRequest<T = unknown> {
  /** 唯一消息 ID */
  id: string
  /** 消息类型 */
  type: string
  /** 请求载荷 */
  payload: T
}

/**
 * Worker 响应消息
 * @template T - payload 类型
 */
export interface WorkerResponse<T = unknown> {
  /** 对应请求的消息 ID */
  id: string
  /** 是否成功 */
  ok: boolean
  /** 响应载荷（成功时） */
  payload?: T
  /** 错误信息（失败时） */
  error?: string
}

/**
 * Worker 消息类型枚举
 */
export const WorkerMessageType = {
  // 战斗模拟相关
  SIMULATE_BATTLE: 'SIMULATE_BATTLE',
  CALCULATE_PLUNDER: 'CALCULATE_PLUNDER',
  CALCULATE_DEBRIS: 'CALCULATE_DEBRIS'
} as const

export type WorkerMessageType = (typeof WorkerMessageType)[keyof typeof WorkerMessageType]
