import { ipcRenderer, remote } from 'electron'

import { AbstractJSONRPC } from './AbstractJSONRPC'
import {
  RPC_SEND_CHANNEL,
  MAIN_TARGET,
  RPC_RECEIVE_CHANNEL,
  BROADCAST_METHOD,
} from './constants'
import {
  JSONRPCRequest,
  JSONRPCResponse,
  Sendable,
  JSONRPCTarget,
} from './type'
import { isRenderer } from './utils'

if (process.env.NODE_ENV === 'development') {
  if (!isRenderer()) {
    throw new Error("don't import 'jsonrpc-electron/renderer' in main process")
  }
}

export const Main = MAIN_TARGET

export class RendererJSONRPC extends AbstractJSONRPC {
  public static instance: RendererJSONRPC

  public static get shared() {
    if (this.instance) {
      return this.instance
    }
    return (this.instance = new this())
  }

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
    if (target == RendererJSONRPC.Main) {
      return { send: ipcRenderer.send.bind(ipcRenderer), id: target }
    }

    if (typeof target === 'number') {
      return remote.webContents.fromId(target)
    } else if (target instanceof remote.BrowserWindow) {
      return target.webContents
    }

    return target
  }

  private setup() {
    // 处理jsonrpc请求
    // senderId 为0时为主进程
    ipcRenderer.on(
      RPC_SEND_CHANNEL,
      (event: { senderId: number }, arg: JSONRPCRequest<any>) => {
        const id = event.senderId
        this.handleRPCRequest(
          {
            id,
            send: (channel: string, args: any[]) => {
              if (id === MAIN_TARGET) {
                ipcRenderer.send(channel, ...args)
              } else {
                ipcRenderer.sendTo(id, channel, ...args)
              }
            },
          },
          arg,
        )
      },
    )

    // 处理JSONRPC响应
    ipcRenderer.on(
      RPC_RECEIVE_CHANNEL,
      (event: { senderId: number }, arg: JSONRPCResponse<any>) => {
        this.handleRPCResponse(arg)
      },
    )
  }
}
