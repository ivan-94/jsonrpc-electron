import { RendererJSONRPC } from './RendererJSONRPC'

export * from './RendererJSONRPC'
export * from './type'

export default () => {
  return RendererJSONRPC.shared
}
