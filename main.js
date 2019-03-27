"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var MainJSONRPC_1 = require("./lib/MainJSONRPC");
tslib_1.__exportStar(require("./lib/MainJSONRPC"), exports);
tslib_1.__exportStar(require("./lib/type"), exports);
exports.default = (function () {
    return MainJSONRPC_1.MainJSONRPC.shared;
});
