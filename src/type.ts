import { WebContents, BrowserWindow } from 'electron'

export type JSONRPCTarget = number | WebContents | BrowserWindow | Sendable

export interface Sendable {
  id: number
  send(channel: string, ...args: any[]): void
}

/**
 * JSONRPC事件请求
 */
export interface JSONRPCRequest<T> {
  jsonrpc: '2.0'
  method: string
  id: string | number
  params?: T
}

/**
 * JSONRPC 事件
 */
export interface JSONRPCEvent<T> {
  jsonrpc: '2.0'
  method: string
  params?: T
}

/**
 * JSONRPC 成功响应
 */
export interface JSONRPCResponseSuccess<T> {
  jsonrpc: '2.0'
  id: string | number
  result: T
}

/**
 * JSONRPC失败响应
 */
export interface JSONRPCResponseError {
  jsonrpc: '2.0'
  id: string | number
  error: JSONRPCError
}

/**
 * JSONRPC响应
 */
export type JSONRPCResponse<T> =
  | JSONRPCResponseSuccess<T>
  | JSONRPCResponseError

export interface JSONRPCError {
  code: number
  message: string
  data?: any
}

/**
 * 通用错误码
 */
export enum JSONRPCErrorCode {
  Timeout,
  Protocol,
  NotFound,
  TargetReleased,
  UnKnown,
}

export type ResponderCallback<T = any> = (result?: T, error?: Error) => void

export interface Responder {
  callback: ResponderCallback
  name: string
  args: any
}

export type HandlerCallback<T = any, R = any> = (
  params: T,
  source: number,
) => Promise<R>
export type EventCallback<T = any> = (params: T, source: number) => void
