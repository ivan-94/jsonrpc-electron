import { BrowserWindow } from 'electron'
import { AbstractJSONRPC } from '../AbstractJSONRPC'
import { JSONRPCTarget } from '../type'
import { RPC_SEND_CHANNEL, DEFAULT_TIMEOUT } from '../constants'

class MockJSONRPC extends AbstractJSONRPC {
  public sender: any = () => {}
  protected getSendable(target: JSONRPCTarget) {
    return {
      id:
        typeof target === 'number'
          ? target
          : target instanceof BrowserWindow
          ? target.webContents.id
          : target.id,
      send: (...args: any[]) => this.sender(target, ...args),
    }
  }

  public getResponders() {
    return this.responder
  }

  public getHandlers() {
    return this.handlers
  }

  public getListeners() {
    return this.listeners
  }

  public testIsTargetEqual(a: JSONRPCTarget, b: JSONRPCTarget) {
    return this.isTargetEqual(a, b)
  }
}

const MOCK_EVENT = 'mockevent'
const MOCK_EVENT2 = 'mockevent2'
const MOCK_TARGET = 1
const MOCK_TARGET2 = 2
const MOCK_METHOD = 'mockmethod'
const MOCK_METHOD2 = 'mockmethod2'
const MOCK_DATE_NOW = 1234
jest.spyOn(Date, 'now').mockImplementation(() => MOCK_DATE_NOW)

describe('test AbstractJSONRPC', () => {
  it('test `on` with listeners queue', () => {
    const mock = new MockJSONRPC()
    const handler = jest.fn()
    mock.on(MOCK_EVENT, handler)

    let listeners = mock.getListeners()
    expect(listeners).toHaveProperty(MOCK_EVENT)
    expect(listeners[MOCK_EVENT]).toEqual([{ callback: handler }])

    const handler2 = jest.fn()
    mock.on(MOCK_EVENT, handler2)

    // register another handler in same event
    listeners = mock.getListeners()
    expect(listeners[MOCK_EVENT].length).toBe(2)
    expect(listeners[MOCK_EVENT]).toContainEqual({ callback: handler2 })

    // register another event
    const handle3 = jest.fn()
    mock.on(MOCK_EVENT2, handle3, MOCK_TARGET)
    listeners = mock.getListeners()
    expect(Object.keys(listeners)).toMatchObject([MOCK_EVENT, MOCK_EVENT2])
    expect(listeners[MOCK_EVENT2]).toEqual([
      { callback: handle3, target: MOCK_TARGET },
    ])

    mock.on(MOCK_EVENT2, handle3, MOCK_TARGET2)
    listeners = mock.getListeners()
    expect(listeners[MOCK_EVENT2]).toContainEqual({
      callback: handle3,
      target: MOCK_TARGET2,
    })
  })

  it('test `off` with listeners queue', () => {
    const mock = new MockJSONRPC()
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    mock.on(MOCK_EVENT, handler1)
    expect(mock.off(MOCK_EVENT, handler2)).toBeFalsy() // not match handler2
    expect(mock.off(MOCK_EVENT, handler1)).toBeTruthy()
    expect(mock.getListeners()[MOCK_EVENT].length).toBe(0)

    // with target
    mock.on(MOCK_EVENT, handler1, MOCK_TARGET)
    expect(mock.off(MOCK_EVENT, handler1)).toBeFalsy() // not match target
    expect(mock.off(MOCK_EVENT, handler1, MOCK_TARGET)).toBeTruthy()
    expect(mock.getListeners()[MOCK_EVENT].length).toBe(0)

    // multi listeners
    mock.on(MOCK_EVENT, handler1, MOCK_TARGET)
    mock.on(MOCK_EVENT, handler1)
    mock.on(MOCK_EVENT, handler2)
    expect(mock.off(MOCK_EVENT, handler1)).toBeTruthy()
    expect(mock.off(MOCK_EVENT, handler2)).toBeTruthy()
    expect(mock.off(MOCK_EVENT, handler1, MOCK_TARGET)).toBeTruthy()
    expect(mock.getListeners()[MOCK_EVENT].length).toBe(0)

    // test with disposer
    const disposer = mock.on(MOCK_EVENT2, handler1)
    expect(disposer()).toBeTruthy()
  })

  describe('test `registerHandler` with handlers queue', () => {
    it('test global handler', () => {
      const mock = new MockJSONRPC()
      const handler1 = jest.fn()
      mock.registerHandler(MOCK_METHOD, handler1)
      expect(mock.getHandlers()).toHaveProperty(MOCK_METHOD)
      expect(mock.getHandlers()[MOCK_METHOD]).toEqual([{ callback: handler1 }])

      expect(() => mock.registerHandler(MOCK_METHOD, handler1)).toThrowError()
      mock.registerHandler(MOCK_METHOD2, handler1)
      expect(mock.getHandlers()).toHaveProperty(MOCK_METHOD2)
      expect(mock.getHandlers()[MOCK_METHOD2]).toEqual([{ callback: handler1 }])
    })

    it('test specified target handler', () => {
      const mock = new MockJSONRPC()
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      mock.registerHandler(MOCK_METHOD, handler1, MOCK_TARGET)
      expect(mock.getHandlers()).toHaveProperty(MOCK_METHOD)

      // add another method
      mock.registerHandler(MOCK_METHOD, handler2, MOCK_TARGET2)
      mock.registerHandler(MOCK_METHOD, handler1)
      expect(mock.getHandlers()[MOCK_METHOD]).toMatchObject([
        { callback: handler1, target: MOCK_TARGET },
        { callback: handler2, target: MOCK_TARGET2 },
        { callback: handler1 },
      ])

      // already existed
      expect(() =>
        mock.registerHandler(MOCK_METHOD, handler1, MOCK_TARGET),
      ).toThrowError()
    })
  })

  describe('test `unregisterHandler` with handlers queue', () => {
    it('test global handler', () => {
      const mock = new MockJSONRPC()
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      mock.registerHandler(MOCK_METHOD, handler1)
      expect(mock.unregisterHandler(MOCK_METHOD)).toBeTruthy()

      // re register
      mock.registerHandler(MOCK_METHOD, handler2)
      expect(mock.unregisterHandler(MOCK_METHOD)).toBeTruthy()

      expect(mock.getHandlers()[MOCK_METHOD].length).toBe(0)
    })

    it('test specified target handle', () => {
      const mock = new MockJSONRPC()
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      mock.registerHandler(MOCK_METHOD, handler1, MOCK_TARGET)
      mock.registerHandler(MOCK_METHOD, handler2, MOCK_TARGET2)
      expect(mock.getHandlers()[MOCK_METHOD].length).toBe(2)

      expect(mock.unregisterHandler(MOCK_METHOD)).toBeFalsy() // not existed
      expect(mock.unregisterHandler(MOCK_METHOD, MOCK_TARGET)).toBeTruthy()
      expect(mock.unregisterHandler(MOCK_METHOD, MOCK_TARGET2)).toBeTruthy()
      expect(mock.getHandlers()[MOCK_METHOD].length).toBe(0)
    })
  })

  it('test isTargetEqual', () => {
    // number to number
    const mock = new MockJSONRPC()
    expect(mock.testIsTargetEqual(1, 1)).toBeTruthy()
    expect(mock.testIsTargetEqual(1, 2)).toBeFalsy()

    // browserWindow
    // @ts-ignore: mock
    const browserWindow = new BrowserWindow(1)
    // @ts-ignore: mock
    const browserWindow2 = new BrowserWindow(2)
    expect(mock.testIsTargetEqual(browserWindow, 1)).toBeTruthy()
    expect(mock.testIsTargetEqual(browserWindow, 2)).toBeFalsy()
    expect(mock.testIsTargetEqual(browserWindow, browserWindow)).toBeTruthy()
    expect(mock.testIsTargetEqual(browserWindow, browserWindow2)).toBeFalsy()

    //webContents
    expect(mock.testIsTargetEqual(1, browserWindow.webContents)).toBeTruthy()
    expect(
      mock.testIsTargetEqual(browserWindow, browserWindow.webContents),
    ).toBeTruthy()
    expect(
      mock.testIsTargetEqual(browserWindow, browserWindow.webContents),
    ).toBeTruthy()
    expect(
      mock.testIsTargetEqual(browserWindow2, browserWindow.webContents),
    ).toBeFalsy()
    expect(
      mock.testIsTargetEqual(
        browserWindow2.webContents,
        browserWindow.webContents,
      ),
    ).toBeFalsy()
  })

  describe('test send', () => {
    it('send as event', () => {
      const mock = new MockJSONRPC()
      const fn = jest.fn()
      mock.sender = fn

      mock.emit(MOCK_TARGET, MOCK_EVENT, 'a')
      expect(fn).toBeCalledWith(MOCK_TARGET, RPC_SEND_CHANNEL, {
        jsonrpc: '2.0',
        method: MOCK_EVENT,
        params: 'a',
      })

      // without params
      mock.emit(MOCK_TARGET, MOCK_EVENT)
      expect(fn).toBeCalledWith(MOCK_TARGET, RPC_SEND_CHANNEL, {
        jsonrpc: '2.0',
        method: MOCK_EVENT,
        params: {},
      })
    })

    describe('send as callHandler', () => {
      beforeAll(() => {
        jest.useFakeTimers()
      })
      afterAll(() => {
        jest.useRealTimers()
      })

      it('test send params & responder queue', () => {
        const mock = new MockJSONRPC()
        const fn = jest.fn()
        mock.sender = fn

        mock.callHandler(MOCK_TARGET, MOCK_METHOD, 'a')
        let id = `1${MOCK_DATE_NOW}`
        expect(fn).toBeCalledWith(MOCK_TARGET, RPC_SEND_CHANNEL, {
          jsonrpc: '2.0',
          method: MOCK_METHOD,
          id,
          params: 'a',
        })
        expect(mock.getResponders()).toHaveProperty(id)

        // without params
        mock.callHandler(MOCK_TARGET, MOCK_METHOD)
        id = `2${MOCK_DATE_NOW}`
        expect(fn).toHaveBeenLastCalledWith(MOCK_TARGET, RPC_SEND_CHANNEL, {
          jsonrpc: '2.0',
          method: MOCK_METHOD,
          id,
          params: {},
        })
        expect(mock.getResponders()).toHaveProperty(id)
      })

      it('test timeout', async () => {
        const mock = new MockJSONRPC()
        const fn = jest.fn()
        mock.sender = fn
        const id = `1${MOCK_DATE_NOW}`
        const promise = mock
          .callHandler(MOCK_TARGET, MOCK_METHOD, 'a')
          .catch(error => {
            expect(error).toBeInstanceOf(MockJSONRPC.Error)
          })
          .then(() => {
            expect(mock.getResponders()).not.toHaveProperty(id)
          })
        expect(mock.getResponders()).toHaveProperty(id)
        jest.advanceTimersByTime(DEFAULT_TIMEOUT)
        return promise
      })
    })
  })
})
