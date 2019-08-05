import { ipcMain, WebContents, BrowserWindow, webContents } from 'electron'

import { AbstractJSONRPC } from './AbstractJSONRPC'
import { RPC_RECEIVE_CHANNEL, RPC_SEND_CHANNEL } from './constants'
import { isRenderer } from './utils'
import {
  Sendable,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCTarget,
} from './type'

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
    BrowserWindow.getAllWindows()
      .map(i => i.webContents)
      .forEach(i => this.send(i, method, params))
  }

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
    ipcMain.on(
      RPC_SEND_CHANNEL,
      (event: { sender: WebContents }, arg: JSONRPCRequest<any>) => {
        this.handleRPCRequest(event.sender, arg)
      },
    )

    // 监听jsonrpc响应
    ipcMain.on(
      RPC_RECEIVE_CHANNEL,
      (event: { sender: WebContents }, arg: JSONRPCResponse<any>) => {
        this.handleRPCResponse(arg)
      },
    )
  }
}
