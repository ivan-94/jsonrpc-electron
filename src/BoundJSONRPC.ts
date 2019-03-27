import { AbstractJSONRPC } from './AbstractJSONRPC'
import { JSONRPCTarget, EventCallback, HandlerCallback } from './type'

/**
 * 绑定Target的JSONRPC
 */
export class BoundJSONRPC {
  public constructor(
    private client: AbstractJSONRPC,
    private target: JSONRPCTarget,
  ) {}

  public emit<T>(method: string, params?: T) {
    return this.client.emit(this.target, method, params)
  }

  public on<T>(method: string, callback: EventCallback<T>) {
    return this.client.on(method, callback, this.target)
  }

  public off(method: string, callback: EventCallback) {
    return this.client.off(method, callback, this.target)
  }

  public callHandler<R, T = {}>(method: string, params?: T): Promise<R> {
    return this.client.callHandler(this.target, method, params)
  }

  public registerHandler<R, T = {}>(
    method: string,
    handler: HandlerCallback<R, T>,
  ) {
    return this.client.registerHandler(method, handler, this.target)
  }

  public unregisterHandler(method: string) {
    return this.client.unregisterHandler(method, this.target)
  }
}
