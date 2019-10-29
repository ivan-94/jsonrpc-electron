import { Sendable } from './type'

/**
 * 判断是否是渲染进程
 */
export function isRenderer() {
  // running in a web browser
  if (typeof process === 'undefined') return true

  // node-integration is disabled
  if (!process) return true

  // We're in node.js somehow
  // @ts-ignore
  if (!process.type) return false

  // @ts-ignore
  return process.type === 'renderer'
}

export function isSendable(t: any): t is Sendable {
  return t && 'send' in t
}
