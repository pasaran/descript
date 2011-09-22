/** @param {string} path */
function require(path) {}

var JSON = {
    stringify:
        /**
            @param {*} o
            @param {*=} a
            @param {*=} b
            @return {string}
        */
        function(o, a, b) {},

    parse:
        /**
            @param {string} s
            @return {Object}
        */
        function(s) {}
};

var module = {};

var process = {
    argv: {}
};

/** @typedef {!Object} */
var nodeHttp;

/** @typedef {!Object} */
nodeHttp.ServerResponse;

/** @type {!Object} */
nodeHttp.ServerResponse.headers;

/** @type {function()} */
nodeHttp.ServerResponse.on;

/** @type {function(function()): nodeHttp.Server} */
nodeHttp.createServer;

/** @typedef {!Object} */
nodeHttp.Server;

/** @type {function(string, string)} */
nodeHttp.Server.listen;

/** @typedef {Object} */
var nodeVm;

/** @type {function(string, Object=, string=)} */
nodeVm.runInNewContext;

/** @typedef {Object} */
var nodeProgram;

/** @type {function(string)} */
nodeProgram.version;

/** @type {function(string)} */
nodeProgram.option;

/** @type {function()} */
nodeProgram.parse;

/** @typedef {Object} */
var nodeUtil;

/** @type {function()} */
nodeUtil.inherits;

