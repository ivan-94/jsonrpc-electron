'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
var tslib_1 = require('tslib')
var RendererJSONRPC_1 = require('./lib/RendererJSONRPC')
tslib_1.__exportStar(require('./lib/RendererJSONRPC'), exports)
tslib_1.__exportStar(require('./lib/type'), exports)
exports.default = function() {
  return RendererJSONRPC_1.RendererJSONRPC.shared
}
