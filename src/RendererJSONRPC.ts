import { ipcRenderer, remote } from 'electron'

import { AbstractJSONRPC } from './AbstractJSONRPC'
import {
  RPC_SEND_CHANNEL,
  MAIN_TARGET,
  RPC_RECEIVE_CHANNEL,
  BROADCAST_METHOD,
} from './constants'
import { Sendable, JSONRPCTarget } from './type'
import { isRenderer, isSendable } from './utils'

if (process.env.NODE_ENV === 'development') {
  if (!isRenderer()) {
    throw new Error("don't import 'jsonrpc-electron/renderer' in main process")
  }
}

export const Main = MAIN_TARGET

const MAIN_SENDABLE = { send: ipcRenderer.send.bind(ipcRenderer), id: Main }

export class RendererJSONRPC extends AbstractJSONRPC {
  public static instance: RendererJSONRPC

  public static get shared() {
    if (this.instance) {
      return this.instance
    }
    return (this.instance = new this())
  }

  /**
   * 缓存发送者
   */
  private senders: Map<any, Sendable> = new Map()

  /**
   * 发送事件给主进程
   * @param method
   * @param params
   */
  public emitMain<T>(method: string, params?: T) {
    this.emit(RendererJSONRPC.Main, method, params)
  }

  /**
   * 通过主进程进行广播
   * @param method
   * @param params
   */
  public broadcast<T>(method: string, params?: T) {
    this.emitMain(BROADCAST_METHOD, { method, params })
  }

  /**
   * 调用主进程的方法
   * @param method
   * @param params
   * @param timeout
   */
  public callMainHandler<R, T = {}>(
    method: string,
    params?: T,
    timeout?: number,
  ) {
    return this.callHandler<R, T>(RendererJSONRPC.Main, method, params, timeout)
  }

  private constructor() {
    super()
    this.setup()
  }

  protected getSendable(target: JSONRPCTarget): Sendable {
    if (target == Main) {
      return MAIN_SENDABLE
    }

    if (this.senders.has(target)) {
      this.senders.get(target)!
    }

    let s: Sendable | undefined

    if (typeof target === 'number') {
      // 这里调用 remote 会触发同步请求
      s = this.generateSendable(target)
    } else if (target instanceof remote.BrowserWindow) {
      s = this.generateSendable(target.webContents.id)
    }

    if (s) {
      this.senders.set(target, s)
      return s
    }

    if (isSendable(target)) {
      return target
    }

    throw new Error(`[JSONPRC] 未知target 类型`)
  }

  private generateSendable(id: number): Sendable {
    const s = {
      id,
      send: ipcRenderer.sendTo.bind(ipcRenderer, id),
    }

    return s
  }

  private setup() {
    // 处理jsonrpc请求
    // senderId 为0时为主进程
    ipcRenderer.on(
      RPC_SEND_CHANNEL,
      (event: { senderId: number }, arg: any) => {
        this.handleRequest(this.getSendable(event.senderId), arg)
      },
    )

    // 处理JSONRPC响应
    ipcRenderer.on(
      RPC_RECEIVE_CHANNEL,
      (event: { senderId: number }, arg: any) => {
        this.handleResponse(arg)
      },
    )
  }
}
