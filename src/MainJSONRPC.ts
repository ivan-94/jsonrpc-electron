import { ipcMain, WebContents, BrowserWindow, webContents } from 'electron'

import { AbstractJSONRPC } from './AbstractJSONRPC'
import {
  RPC_RECEIVE_CHANNEL,
  RPC_SEND_CHANNEL,
  BROADCAST_METHOD,
} from './constants'
import { isRenderer } from './utils'
import { Sendable, JSONRPCTarget } from './type'

if (process.env.NODE_ENV === 'development') {
  if (isRenderer()) {
    throw new Error("don't import 'jsonrpc-electron/main' in renderer process")
  }
}

/**
 * 主线程JSONRPC客户端
 */
export class MainJSONRPC extends AbstractJSONRPC {
  public static instance: MainJSONRPC

  public static get shared() {
    if (this.instance) {
      return this.instance
    }
    return (this.instance = new this())
  }

  private constructor() {
    super()
    this.setup()
  }

  /**
   * 向所有renderer广播事件
   * @param method
   * @param params
   */
  public broadcast<T>(method: string, params?: T) {
    BrowserWindow.getAllWindows().forEach(i =>
      this.send(i.webContents, method, params),
    )
  }

  // TODO: 批量发送机制
  protected getSendable(target: JSONRPCTarget): Sendable {
    if (target === MainJSONRPC.Main) {
      throw new Error(`[JSONRPC] can't send message to main itself`)
    }

    return typeof target === 'number'
      ? webContents.fromId(target)
      : target instanceof BrowserWindow
      ? target.webContents
      : target
  }

  private setup() {
    // 监听jsonrpc请求
    ipcMain.on(RPC_SEND_CHANNEL, (event: { sender: WebContents }, arg: any) => {
      this.handleRequest(event.sender, arg)
    })

    // 监听jsonrpc响应
    ipcMain.on(
      RPC_RECEIVE_CHANNEL,
      (event: { sender: WebContents }, arg: any) => {
        this.handleResponse(arg)
      },
    )

    // 内置事件
    this.on(BROADCAST_METHOD, (params: { method: string; params: any }) => {
      this.broadcast(params.method, params.params)
    })
  }
}
