var no = require('nommon');

var de = require('./de.js');
require('./de.common.js');
require('./de.result.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var url_ = require('url');
var http_ = require('http');
var qs_ = require('querystring');

//  ---------------------------------------------------------------------------------------------------------------  //

de.http = function(options, params, context) {
    var parsed = url_.parse(options.url, true, true);

    if (params) {
        parsed.query = no.extend(parsed.query || {}, params)
    }

    var max_redirects = ( options.max_redirects === undefined ) ? 3 : options.max_redirects;
    var only_status = options.only_status;

    parsed.headers = options.headers;
    parsed.method = options.method;

    var req;
    var promise = new no.Promise();

    promise.on('abort', function() {
        req.abort();
    });

    var full_path = '[http ' + url_.format(parsed) + '] ';
    var http_status = 0;
    var received_length = 0;

    var t1 = Date.now();
    promise.done(function() {
        context.log_end('info', full_path + http_status + ' ' + received_length + ' ended', t1);
    });
    promise.fail(function() {
        context.log_end('info', full_path + http_status + ' failed', t1);
    });

    doHttp(parsed, 0);

    return promise;

    function doHttp(options, count) {
        var post_data;
        if (options.method === 'post') {
            var headers = options.headers || (( options.headers = {} ));

            if ('application/json' === headers['Content-Type']) {
                post_data = JSON.stringify(options.query);
            } else {
                post_data = qs_.stringify(options.query);
            }

            if (post_data) {
                //  FIXME: Если никаких данных не передается, то, кажется,
                //  эти заголовки и не нужны вовсе?
                //
                if (!headers['Content-Type']) {
                    headers['Content-Type'] = 'application/x-www-form-urlencoded';
                }
                headers['Content-Length'] = post_data.length;
            }

        } else {
            options.path = url_.format({
                pathname: options.pathname,
                query: options.query
            });
        }

        req = http_.request(options, function(res) {
            var status = res.statusCode;

            if (only_status) {
                //  FIXME: Непонятно, нужно ли это?
                //  Но если там длинная дата, то ждать ее нет смысла.
                req.abort();

                return promise.resolve( new de.Result.Value({
                    status: status,
                    headers: res.headers
                }) );
            }

            http_status = status;

            var error;
            if (status === 301 || status === 302) {
                //  TODO: Кэшировать 301 запросы.

                //  FIXME: А это нельзя вынести повыше?
                res.resume();

                var location = res.headers['location'] || '';

                // FIXME: MAX_REDIRECTS.
                if (count >= max_redirects) {
                    context.error('Too many redirects');
                    return promise.reject( de.error({
                        'id': 'HTTP_TOO_MANY_REDIRECTS',
                        'status': status,
                        'location': location
                    }) );
                }

                location = url_.resolve(options.href, location);
                options = url_.parse(location, true, true);

                context.info(full_path + 'redirected to ' + location);

                return doHttp(options, count + 1);
            }

            var result = new de.Result.Http(res.headers);

            res.on('data', function(data) {
                received_length += data.length;
                result.data(data);
            });
            res.on('end', function() {
                result.end();

                if (status >= 400 && status <= 599) {
                    context.error(full_path + 'error ' + status);

                    var mime = de.mime( res.headers );

                    var body;
                    if ( mime === 'application/json' ) {
                        try {
                            body = JSON.parse( result.buffer );
                        } catch ( e ) {
                            body = 'JSON.parse: Cannot parse response body';
                        }
                    }

                    return promise.reject( de.error({
                        'id': 'HTTP_' + status,
                        'message': http_.STATUS_CODES[status],
                        'body': body
                    }) );

                } else {
                    promise.resolve(result);
                }
            });
            res.on('close', function(error) {
                context.error(full_path + 'error ' + error.message);
                promise.reject( de.error({
                    'id': 'HTTP_CONNECTION_CLOSED',
                    'message': error.message
                }) );
            });
        });

        req.on('error', function(error) {
            context.error(full_path + 'error ' + error.message);
            promise.reject( de.error({
                'id': 'HTTP_UNKNOWN_ERROR',
                'message': error.message
            }) );
        });

        if (post_data) {
            req.write(post_data);
        }
        req.end();
    }

};

// ----------------------------------------------------------------------------------------------------------------- //

de.http.get = function(url, params, headers, context) {
    return de.http(
        {
            url: url,
            headers: headers,
            method: 'get'
        },
        params,
        context
    );
};

de.http.post = function(url, params, headers, context) {
    return de.http(
        {
            url: url,
            headers: headers,
            method: 'post'
        },
        params,
        context
    );
};

//  ---------------------------------------------------------------------------------------------------------------  //
