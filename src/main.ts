import { MainJSONRPC } from './MainJSONRPC'

export * from './MainJSONRPC'
export * from './type'

export default () => {
  return MainJSONRPC.shared
}
