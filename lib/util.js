var util = {};

// ----------------------------------------------------------------------------------------------------------------- //

var $http = require('http');
var $path = require('path');

// ----------------------------------------------------------------------------------------------------------------- //

var Result = require('./result.js');

// ----------------------------------------------------------------------------------------------------------------- //

var config = global.config || {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {!Object} dest
    @param {...!Object} srcs
    @return {!Object}
*/
util.extends = function(dest) {
    for (var i = 1, l = arguments.length; i < l; i++) {
        var src = arguments[i];
        for (var key in src) {
            dest[key] = src[key];
        }
    }

    return dest;
};

// ----------------------------------------------------------------------------------------------------------------- //

util.http = {};

util.http.get = function(options, promise) {
    options.method = 'GET';
    util.http.request(options, promise);
};

util.http.request = function(options, promise) {
    var data = '';

    var req = $http.request( options, function(res) {
        var status = res.statusCode;
        var headers = res.headers;

        var error;
        switch (status) {
            case 301:
            case 302:
                error = {
                    id: 'DESCRIPT_NOT_IMPLEMENTED',
                    message: 'Redirect to ' + headers['location']
                };
                break;

            case 400:
                error = {
                    id: 'HTTP_400',
                    message: 'Bad Request'
                };
                break;

            case 403:
                error = {
                    id: 'HTTP_403',
                    message: 'Forbidden'
                };
                break;

            case 404:
                error = {
                    id: 'HTTP_404',
                    message: 'Not Found'
                };
                break;

            case 500:
                error = {
                    id: 'HTTP_500',
                    message: 'Internal Server Error'
                };
                break;

            case 503:
                error = {
                    id: 'HTTP_503',
                    message: 'Service Unavailable'
                };
                break;

        }

        if (error) {
            promise.resolve( new Result.Error(error) );

        } else {
            res.on('data', function(chunk) {
                data += chunk;
            });
            res.on('end', function() {
                var contentType = headers['content-type'];

                if (contentType.indexOf('application/json') !== -1) {
                    promise.resolve( new Result(data) );
                } else {
                    promise.resolve( new Result.Value(data) );
                }
            });
            res.on('close', function(error) {
                promise.resolve( new Result.Error({
                    id: 'HTTP_CONNECTION_CLOSED',
                    message: ''
                }) );
            });

        }
    } );

    req.on('error', function(error) {
        promise.resolve( new Result.Error({
            id: 'HTTP_UNKNOWN',
            message: error.message
        }) );
    });

    req.end();
};

// ----------------------------------------------------------------------------------------------------------------- //

util.resolveFilename = function(dirname, filename) {
    var root = config.rootdir;

    if (/^\//.test(filename)) { // Absolute path.
        filename = $path.join(root, filename);
    } else {
        filename = $path.resolve(dirname, filename);
        // FIXME: Проверить, что путь не вышел за пределы root'а.
    }

    return filename;
};

// ----------------------------------------------------------------------------------------------------------------- //

util.compileString = function(string) {
    var parts = string.split(/{(.*?)}/g);

    var body = [];
    for (var i = 0, l = parts.length; i < l; i++) {
        var part = parts[i];

        if (i % 2) {
            var r = part.match(/^(state|config)\.(.*)$/);
            if (r) {
                body.push(r[1] + '["' + r[2] + '"]');
            } else {
                body.push('request["' + part + '"]');
            }
        } else {
            body.push('"' + part + '"');
        }
    }

    return new Function('context', 'var state = context.state, request = context.request, config = context.config; return ' + body.join('+'));
};

util.compileJPath = function(string) {
    var parts = string.split(/\./g);

    var body = '';
    for (var i = 0, l = parts.length; i < l; i++) {
        var r = parts[i].match(/^(.+?)(\[\d+\])?$/);
        body += 'if (!r) return null;r = r["' + r[1] + '"];';
        if (r[2]) {
            body += 'if (!r) return null;r = r' + r[2] + ';';
        }
    }

    return new Function('r', body + 'return r;');
};

// ----------------------------------------------------------------------------------------------------------------- //

util.parseCookies = function(cookie) {
    var cookies = {};

    var parts = cookie.split(';');
    for (var i = 0, l = parts.length; i < l; i++) {
        var r = parts[i].match(/^\s*([^=]+)=(.*)$/);
        if (r) {
            cookies[ r[1] ] = r[2];
        }
    }

    return cookies;
};

// ----------------------------------------------------------------------------------------------------------------- //

module.exports = util;

// ----------------------------------------------------------------------------------------------------------------- //

