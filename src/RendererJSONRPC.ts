import { ipcRenderer, remote } from 'electron'
import { AbstractJSONRPC } from './AbstractJSONRPC'
import { RPC_SEND_CHANNEL, MAIN_TARGET, RPC_RECEIVE_CHANNEL } from './constants'
import {
  JSONRPCRequest,
  JSONRPCResponse,
  Sendable,
  JSONRPCTarget,
} from './type'

export const Main = MAIN_TARGET

export class RendererJSONRPC extends AbstractJSONRPC {
  public static instance: RendererJSONRPC

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
