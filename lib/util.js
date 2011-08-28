var util = {};

// ----------------------------------------------------------------------------------------------------------------- //

var $http = require('http');
var $path = require('path');

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

util.httpGet = function(options, callback) {

    options.method = 'GET';

    var data = '';

    var req = $http.request( options, function(res) {
        res.on('data', function(chunk) {
            data += chunk;
        });
        res.on('end', function() {
            callback( null, {
                status: res.statusCode,
                headers: res.headers,
                data: data
            } );
        });
        /*
        res.on('close', function(error) {
            // TODO: Сделать что-нибудь.
        });
        */
    } );

    req.on('error', function(error) {
        callback(error);
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

