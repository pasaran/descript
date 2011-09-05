var util = {};

// ----------------------------------------------------------------------------------------------------------------- //

var $http = require('http');
var $path = require('path');
var $url = require('url');

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

util.http.url2options = function(url, params) {
    url = $url.parse(url, true);

    var query = url.query || {};
    if (params) {
        util.extends(query, params);
    }

    return {
        host: url.hostname,
        path: $url.format({
            pathname: url.pathname,
            query: query
        }),
        port: url.port || 80
    };
};

var errorMessages = {
    400: 'Bad Request',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    503: 'Service Unavailable'
};

util.http.get = function(options, callback) {
    var data = [];

    var req = $http.request( options, function(res) {
        var headers = res.headers;
        var status = res.statusCode;

        var error;
        switch (status) {
            case 301:
            case 302:
                var location = headers['location'];
                var redirect = util.http.url2options(location);
                if (!redirect.host) {
                    redirect.host = options.host;
                }
                return util.http.get(redirect, callback); // TODO: Ограничивать количество редиректов.

            case 400:
            case 403:
            case 404:
            case 500:
            case 503:
                error = {
                    id: 'HTTP_' + status,
                    message: errorMessages[status]
                };
                break;
        }

        if (error) {
            callback( new Result.Error(error) );

        } else {
            res.on('data', function(chunk) {
                data.push(chunk);
            });
            res.on('end', function() {
                var contentType = headers['content-type'];

                if (contentType.indexOf('application/json') !== -1) {
                    callback( new Result.Raw(data, true) );
                } else {
                    callback( new Result.Raw(data) );
                }
            });
            res.on('close', function(error) {
                callback( new Result.Error({
                    id: 'HTTP_CONNECTION_CLOSED',
                    message: error.message
                }) );
            });

        }
    } );

    req.on('error', function(error) {
        callback( new Result.Error({
            id: 'HTTP_UNKNOWN_ERROR',
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

