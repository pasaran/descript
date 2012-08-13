//  ---------------------------------------------------------------------------------------------------------------  //
//  common
//  ---------------------------------------------------------------------------------------------------------------  //

var path_ = require('path');
var fs_ = require('fs');
var url_ = require('url');
var http_ = require('http');

//  ---------------------------------------------------------------------------------------------------------------  //

var no = require('noscript');

var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

de.extend = function(dest, srcs) {
    for (var i = 1, l = arguments.length; i < l; i++) {
        var src = arguments[i];
        for (var key in src) {
            dest[key] = src[key];
        }
    }

    return dest;
};

//  ---------------------------------------------------------------------------------------------------------------  //

/*
de.resolveFilename = function(dirname, filename) {
    var root = ds.config['rootdir'];

    if (/^\//.test(filename)) {
        //  Absolute path.
        filename = path_.join(root, filename);
    } else {
        filename = path_.resolve(dirname, filename);
        //  FIXME: Проверить, что путь не вышел за пределы root'а.
    }

    return filename;
};
*/

// ----------------------------------------------------------------------------------------------------------------- //

de.compileString = function(string) {
    var parts = string.split(/{\s*([^\s}]*)\s*}/g);

    var body = [];
    for (var i = 0, l = parts.length; i < l; i++) {
        var part = parts[i];

        if (i % 2) {
            var r = part.match(/^(state|config)\.(.*)$/);
            if (r) {
                //  TODO: Нужно уметь еще и { config.blackbox.url }.
                body.push('(' + r[1] + '["' + r[2] + '"] || "")');
            } else {
                body.push('( params["' + part + '"] || "")');
            }
        } else {
            body.push('"' + part + '"');
        }
    }

    return new Function('context', 'params', 'var state = context.state, config = context.config; return ' + body.join('+'));
};

de.compileJPath = function(string) {
    var parts = string.split(/\./g);

    var body = '';
    for (var i = 0, l = parts.length; i < l; i++) {
        var r = parts[i].match(/^(.+?)(\[\d+\])?$/);
        body += 'if (!r) return; r = r["' + r[1] + '"];';
        if (r[2]) {
            body += 'if (!r) return; r = r' + r[2] + ';';
        }
    }

    return new Function('r', body + 'return r;');
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.parseCookies = function(cookie) {
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

//  ---------------------------------------------------------------------------------------------------------------  //

de.duration = function(s) {
    if (typeof s === 'number') {
        return s;
    }

    var parts = s.split(/(\d+)([dhms])/);
    var d = 0;

    for (var i = 0, l = parts.length; i < l; i += 3) {
        var n = +parts[i + 1];

        switch (parts[i + 2]) {
            case 'd':
                d += n * (60 * 60 * 24);
                break;
            case 'h':
                d += n * (60 * 60);
                break;
            case 'm':
                d += n * (60);
                break;
            case 's':
                d += n;
                break;
        }
    }

    return d * 1000;
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.events
//  ---------------------------------------------------------------------------------------------------------------  //

de.events = de.extend( {}, no.Events );


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.file
//  ---------------------------------------------------------------------------------------------------------------  //

de.file = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.file._cache = {};

de.file.get = function(filename) {
    var promise = de.file._cache[filename];

    if (!promise) {
        promise = de.file._cache[filename] = new no.Promise();

        fs_.readFile(filename, function(error, content) {
            if (error) {
                //  Если не удалось считать файл, в следующий раз нужно повторить попытку,
                //  а не брать из кэша ошибку.
                delete de.file._cache[filename];

                promise.reject({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                });
            } else {
                //  Содержимое файла закэшировано внутри promise'а. Следим, не изменился ли файл.
                de.file.watch(filename);
                promise.resolve(content);
            }

        });
    }

    return promise;
};

de.events.on('file-changed', function(e, filename) {
    //  Файл изменился, выкидываем его из кэша.
    delete de.file._cache[filename];

    // FIXME: Не нужно ли тут делать еще и unwatch?
});

//  ---------------------------------------------------------------------------------------------------------------  //

de.file._watched = {};

de.file.watch = function(filename) {
    //  FIXME: Непонятно, как это будет жить, когда файлов будет много.
    if ( !de.file._watched[filename] ) {
        de.file._watched[filename] = true;

        fs_.watchFile(filename, function (curr, prev) {
            if ( prev.mtime.getTime() !== curr.mtime.getTime() ) {
                de.events.trigger('file-changed', filename);
            }
        });
    }
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.http
//  ---------------------------------------------------------------------------------------------------------------  //

de.http = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.http.url2options = function(url, params) {
    url = url_.parse(url, true);

    var query = url.query || {};
    if (params) {
        no.extend(query, params);
    }

    return {
        'host': url.hostname,
        'path': url_.format({
            'pathname': url.pathname,
            'query': query
        }),
        'port': url.port || 80
    };
};

// ----------------------------------------------------------------------------------------------------------------- //

de.http.errorMessages = {
    '400': 'Bad Request',
    '403': 'Forbidden',
    '404': 'Not Found',
    '500': 'Internal Server Error',
    '503': 'Service Unavailable'
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.http.get = function(url) {
    var promise = new no.Promise();

    de.http._get(url, promise, 0);

    return promise;
};

de.http._get = function(options, promise, count) {
    var data = [];

    var req = http_.request( options, function(res) {
        var headers = res.headers;
        var status = res.statusCode;

        var error;
        switch (status) {
            case 301:
            case 302:
                if (count > 3) { // FIXME: MAX_REDIRECTS.
                    return promise.reject({
                        'id': 'HTTP_TOO_MANY_REDIRECTS'
                    });
                }

                var location = headers['location'];
                var redirect = de.http.url2options(location);
                if (!redirect.host) {
                    redirect.host = options.host;
                }
                return de.http._get(redirect, promise, count + 1);

            case 400:
            case 403:
            case 404:
            case 500:
            case 503:
                error = {
                    'id': 'HTTP_' + status,
                    'message': de.http.errorMessages[status]
                };
                break;

            //  TODO: default:
        }

        if (error) {
            promise.reject(error);

        } else {
            res.on('data', function(chunk) {
                data.push(chunk);
            });
            res.on('end', function() {
                promise.resolve(data);
            });
            res.on('close', function(error) {
                promise.reject({
                    'id': 'HTTP_CONNECTION_CLOSED',
                    'message': error.message
                });
            });

        }
    } );

    req.on('error', function(error) {
        promise.reject({
            'id': 'HTTP_UNKNOWN_ERROR',
            'message': error.message
        });
    });

    req.end();
};

//  ---------------------------------------------------------------------------------------------------------------  //

