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
    /** @type {Array} */
    'argv': [],

    /** @type {function()} */
    'cwd': function() {}
};

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodeFs;

/** @type {function()} */
nodeFs.readFile;

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodeHttp = {};

/** @typedef {Object} */
nodeHttp.ServerResponse;

/** @type {Object} */
nodeHttp.ServerResponse.headers;

/** @type {function()} */
nodeHttp.ServerResponse.on;

/** @type {function(function()): nodeHttp.Server} */
nodeHttp.createServer = function() {};

/** @typedef {Object} */
nodeHttp.Server;

/** @type {function(string, string)} */
nodeHttp.Server.listen = function() {};

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodeVm;

/** @type {function(string, Object=, string=)} */
nodeVm.runInNewContext;

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodeProgram;

/** @type {function(string)} */
nodeProgram.version;

/** @type {function(string)} */
nodeProgram.option;

/** @type {function()} */
nodeProgram.parse;

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodeUtil;

/** @type {function()} */
nodeUtil.inherits;

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodePath;

/** @type {function()} */
nodePath.join;

/** @type {function()} */
nodePath.resolve;

/** @type {function()} */
nodePath.dirname;

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodeQueryString;

/** @type {function()} */
nodeQueryString.stringify;

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodeUrl;

/** @type {function()} */
nodeUrl.parse;

/** @type {function()} */
nodeUrl.format;

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodeServerResponse;

/** @type {function()} */
nodeServerResponse.setHeader;

/** @type {number} */
nodeServerResponse.statusCode;

/** @type {function()} */
nodeServerResponse.end;

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {Object} */
var nodeServerRequest;

/** @type {string} */
nodeServerRequest.url;

/** @type {Object} */
nodeServerRequest.headers;

// ----------------------------------------------------------------------------------------------------------------- //

