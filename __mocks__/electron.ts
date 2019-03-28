class MockWebContents {
  public constructor(public id: number) {}
}

export class BrowserWindow {
  public webContents: MockWebContents
  constructor(id: number) {
    this.webContents = new MockWebContents(id)
  }
}
