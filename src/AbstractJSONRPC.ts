import {
  RPC_SEND_CHANNEL,
  RPC_RECEIVE_CHANNEL,
  DEFAULT_TIMEOUT,
  MAIN_TARGET,
} from './constants'
import {
  ResponderCallback,
  HandlerCallback,
  EventCallback,
  JSONRPCErrorCode,
  Sendable,
  JSONRPCResponse,
  JSONRPCRequest,
  JSONRPCResponseError,
  JSONRPCResponseSuccess,
  JSONRPCTarget,
  Responder,
} from './type'
import { BoundJSONRPC } from './BoundJSONRPC'

/**
 * 错误对象
 */
export class JSONRPCError implements Error {
  public stack = new Error().stack
  public name = 'JSONRPCError'
  public methodName?: string
  public args?: any

  // 从JSONRPC 响应中恢复
  public static recoverFromResponse(
    res: JSONRPCResponseError,
    responder: Responder,
  ) {
    const errorMessage = `[${responder.name}(${JSON.stringify(
      responder.args,
    )})]: ${res.error.message || ''}`
    const err = new JSONRPCError(
      res.error.code,
      errorMessage,
      res.error.data && res.error.data.data,
    )
    if (res.error.data && res.error.data.stack) {
      err.stack = res.error.data.stack
    }
    err.methodName = responder.name
    err.args = responder.args
    return err
  }

  constructor(public code: number, public message: string, public data?: any) {}

  public toJSON() {
    return {
      name: 'JSONRPCError',
      code: this.code,
      message: this.message,
      methodName: this.methodName,
      args: this.args,
      data: this.data,
      stack: this.stack,
    }
  }
}

/**
 * a JSON-RPC client for communicate with renderers
 */
export abstract class AbstractJSONRPC {
  /**
   * 表示main线程，可以用于emit，callHandler
   */
  public static Main = MAIN_TARGET
  /**
   * JSONRPC 错误对象
   */
  public static Error = JSONRPCError

  private uid = 0

  /**
   * 用于接收对端的回调
   */
  protected responder: {
    [id: string]: Responder
  } = {}

  /**
   * 当前进程已注册的方法
   */
  protected handlers: {
    [method: string]: Array<{
      target?: JSONRPCTarget
      callback: HandlerCallback
    }>
  } = {}

  /**
   * 当前进程已注册的事件监听器
   */
  protected listeners: {
    [method: string]: Array<{
      target?: JSONRPCTarget
      callback: EventCallback
    }>
  } = {}

  /**
   * 绑定target
   * @param target
   * @deprecated 使用场景非常少
   */
  public bind(target: JSONRPCTarget) {
    return new BoundJSONRPC(this, target)
  }

  /**
   * 向指定renderer发送事件
   * @param target
   * @param method
   * @param params
   */
  public emit<T>(target: JSONRPCTarget, method: string, params?: T) {
    this.send(target, method, params)
  }

  /**
   * 监听事件
   * @param method
   * @param callback
   * @param target 可选，支持绑定target
   * @returns 返回一个disposer，用于取消订阅
   */
  public on<T>(
    method: string,
    callback: EventCallback<T>,
    target?: JSONRPCTarget,
  ) {
    if (this.listeners[method]) {
      this.listeners[method].push({ callback, target })
    } else {
      this.listeners[method] = [{ callback, target }]
    }

    return () => {
      return this.off(method, callback, target)
    }
  }

  /**
   * 取消事件监听
   * @param method
   * @param callback
   * @param target 可选，支持绑定target
   */
  public off(method: string, callback: EventCallback, target?: JSONRPCTarget) {
    if (this.listeners[method]) {
      const idx = this.listeners[method].findIndex(
        i => i.callback === callback && this.isTargetEqual(i.target, target),
      )
      if (idx !== -1) {
        this.listeners[method].splice(idx, 1)
        return true
      }
    }
    return false
  }

  /**
   * 调用执行renderer的方法
   * @param target
   * @param method
   * @param params
   * @param timeout 超时时间，默认是300000(30s)
   */
  public callHandler<R, T = {}>(
    target: JSONRPCTarget,
    method: string,
    params?: T,
    timeout?: number,
  ): Promise<R> {
    return new Promise((res, rej) => {
      this.send(
        target,
        method,
        params,
        (result, error) => {
          if (error != null) {
            rej(error)
          } else {
            res(result as R)
          }
        },
        timeout,
      )
    })
  }

  /**
   * 注册方法，供renderer调用
   * @param method
   * @param handler
   * @param target 可选，只接受该target的请求
   */
  public registerHandler<R, T = {}>(
    method: string,
    handler: HandlerCallback<R, T>,
    target?: JSONRPCTarget,
  ) {
    if (
      target == null &&
      this.handlers[method] &&
      this.handlers[method].some(i => i.target == null)
    ) {
      throw new Error(`[JSONRPC] registerHandler global ${method} 已存在`)
    }

    if (
      target &&
      this.handlers[method] &&
      this.handlers[method].some(i => this.isTargetEqual(target, i.target))
    ) {
      throw new Error(
        `[JSONRPC] registerHandler(${JSON.stringify(target)}) ${method} 已存在`,
      )
    }

    if (this.handlers[method]) {
      this.handlers[method].push({ callback: handler, target })
    } else {
      this.handlers[method] = [
        {
          target,
          callback: handler,
        },
      ]
    }

    return () => {
      return this.unregisterHandler(method, target)
    }
  }

  /**
   * 取消注册
   * @param method
   */
  public unregisterHandler(method: string, target?: JSONRPCTarget) {
    if (this.handlers[method]) {
      const idx = this.handlers[method].findIndex(i =>
        this.isTargetEqual(i.target, target),
      )

      if (idx !== -1) {
        this.handlers[method].splice(idx, 1)
        return true
      }
    }

    return false
  }

  /**
   * 获取可发送对象, 由子类实现
   * @param target
   */
  protected abstract getSendable(target: JSONRPCTarget): Sendable | undefined

  /**
   * 底层发送方法
   * @param target 可以是webContents id 或者BrowserWindow和WebContent
   * @param method
   * @param params
   * @param callback
   */
  protected send<R, T>(
    target: JSONRPCTarget,
    method: string,
    params?: T,
    callback?: ResponderCallback<R>,
    timeout?: number,
  ) {
    const isEvent = callback == null
    const id = isEvent ? undefined : this.getId()

    const payload = {
      jsonrpc: '2.0',
      method,
      id,
      params: params || {},
    }

    const sender = (sendable: Sendable | undefined) => {
      if (sendable == null) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[JSONRPC] can't send message to released target: `,
            target,
          )
        }

        if (!isEvent) {
          callback!(
            undefined,
            new AbstractJSONRPC.Error(
              JSONRPCErrorCode.TargetReleased,
              `can't send message to released target: ${target}`,
            ),
          )
        }
        return false
      }

      if (!isEvent) {
        // 需要监听renderer响应
        let resolved = false
        let timer: NodeJS.Timeout | undefined
        const _timeout = timeout || DEFAULT_TIMEOUT
        const timeoutEnabled = _timeout > 0 && _timeout !== Infinity

        // 超时机制
        if (timeoutEnabled) {
          timer = setTimeout(() => {
            if (resolved) {
              return
            }

            resolved = true
            callback!(
              undefined,
              new AbstractJSONRPC.Error(
                JSONRPCErrorCode.Timeout,
                `${method} 调用超时`,
              ),
            )

            // tslint:disable-next-line:no-dynamic-delete
            delete this.responder[id!]
          }, _timeout)
        }

        this.responder[id!] = {
          callback: (result, error) => {
            if (resolved) {
              return
            }
            resolved = true
            if (timer) {
              clearTimeout(timer)
            }
            callback!(result, error)
          },
          name: method,
          args: params,
        }
      }

      sendable.send(RPC_SEND_CHANNEL, payload)
      return true
    }

    return sender(this.getSender(target))
  }

  /**
   * 判断是否是同一个target
   * @param a
   * @param b
   */
  protected isTargetEqual(a?: JSONRPCTarget, b?: JSONRPCTarget) {
    if (a == null && b == null) {
      return true
    }

    if ((a == null && b != null) || (b == null && a != null)) {
      return false
    }

    const sendableA = this.getSender(a!)
    const sendableB = this.getSender(b!)

    if (sendableA && sendableB && sendableA.id === sendableB.id) {
      return true
    }

    return false
  }

  /**
   * 判断sender是否匹配target
   * @param a
   * @param target
   */
  protected isSenderMatchTarget(a: Sendable, target?: JSONRPCTarget) {
    let t: Sendable | undefined
    return target == null ? true : (t = this.getSender(target)) && t.id === a.id
  }

  /**
   * 处理JSONRPC回调响应
   * @param res
   */
  protected handleRPCResponse(res: JSONRPCResponse<any>) {
    const { id } = res
    const responder = this.responder[id]
    if (responder == null) {
      console.warn(`[JSONRPC] responder for ${id} not found`)
      return
    }

    if ('error' in res) {
      // 调用异常
      responder.callback(
        undefined,
        AbstractJSONRPC.Error.recoverFromResponse(res, responder),
      )
    } else {
      responder.callback(res.result)
    }

    // tslint:disable-next-line:no-dynamic-delete
    delete this.responder[id]
  }

  protected getHandlerFor(method: string, sender: Sendable) {
    if (this.handlers[method] == null) {
      return undefined
    }

    let handler:
      | {
          target?: JSONRPCTarget
          callback: HandlerCallback
        }
      | undefined

    for (const item of this.handlers[method]) {
      if (item.target == null) {
        handler = item
      } else if (this.isSenderMatchTarget(sender, item.target)) {
        handler = item
        break
      }
    }

    return handler
  }

  /**
   * 处理JSONRPC响应
   * @param sender
   * @param req
   */
  protected handleRPCRequest(sender: Sendable, req: JSONRPCRequest<any>) {
    const { params, id, method } = req
    const isEvent = id == null
    if (isEvent) {
      // 事件调用
      if (this.listeners[method]) {
        this.listeners[method].slice(0).forEach(i => {
          if (this.isSenderMatchTarget(sender, i.target)) {
            i.callback(params, sender.id)
          }
        })
      }
    } else {
      // 方法请求
      const handler = this.getHandlerFor(method, sender)
      if (handler == null) {
        const res: JSONRPCResponseError = {
          id,
          jsonrpc: '2.0',
          error: {
            code: JSONRPCErrorCode.NotFound,
            message: `method ${method} not found`,
          },
        }
        sender.send(RPC_RECEIVE_CHANNEL, res)
      } else {
        handler
          .callback(params, sender.id)
          .then(result => {
            const res: JSONRPCResponseSuccess<any> = {
              id,
              jsonrpc: '2.0',
              result,
            }
            sender.send(RPC_RECEIVE_CHANNEL, res)
          })
          .catch(err => {
            const res: JSONRPCResponseError = {
              id,
              jsonrpc: '2.0',
              error:
                err instanceof AbstractJSONRPC.Error
                  ? {
                      code: err.code,
                      message: err.message,
                      data: { data: err.data, stack: err.stack },
                    }
                  : {
                      code: JSONRPCErrorCode.UnKnown,
                      message: err.message || err,
                      data: { stack: err.stack },
                    },
            }
            sender.send(RPC_RECEIVE_CHANNEL, res)
          })
      }
    }
  }

  private getSender(target: JSONRPCTarget) {
    if (process.env.NODE_ENV === 'development' && this.getSendable == null) {
      throw new Error('[JSONRPC] getSendable is not defined')
    }

    try {
      return this.getSendable(target)
    } catch (err) {
      console.warn('[JSONRPC] failed to getSendable', err)
      return undefined
    }
  }

  /**
   * 获取唯一的id
   */
  private getId() {
    return `${(this.uid =
      (this.uid + 1) % Number.MAX_SAFE_INTEGER)}${Date.now()}`
  }
}
