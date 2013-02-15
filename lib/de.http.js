var no = require('nommon');

var de = require('./de.js');

require('./de.result.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var url_ = require('url');
var http_ = require('http');

//  ---------------------------------------------------------------------------------------------------------------  //

de.http = {};

// ----------------------------------------------------------------------------------------------------------------- //

de.http.get = function(url, params, datatype) {
    var options = url_.parse(url, true, true);

    if (params) {
        //  NOTE: Оказывается, http.request не смотрит на параметр query,
        //  а смотрит только на path. Поэтому приходится формировать новый path.
        options.path = url_.format({
            pathname: options.pathname,
            query: no.extend(options.query, params)
        });
    }

    var req;
    var promise = new no.Promise();

    promise.on('abort', function() {
        if (req) {
            req.abort();
            req = null;
        }
    });

    getHttp(options, 0);

    return promise;

    function getHttp(options, count) {
        var data = [];
        var length = 0;

        req = http_.request(options, function(res) {
            req = null;

            var status = res.statusCode;

            var error;
            switch (status) {
                //  TODO: Кэшировать 301 запросы.
                case 301:
                case 302:
                    if (count > 3) { // FIXME: MAX_REDIRECTS.
                        return promise.reject( de.error({
                            'id': 'HTTP_TOO_MANY_REDIRECTS'
                        }) );
                    }

                    var location = res.headers['location'] || '';
                    location = url_.resolve(options.href, location);
                    options = url_.parse(location, true, true);

                    return getHttp(options, count + 1);

                case 400:
                case 403:
                case 404:
                case 500:
                case 503:
                    return promise.reject( de.error({
                        'id': 'HTTP_' + status,
                        'message': http_.STATUS_CODES[status]
                    }) );
            }

            res.on('data', function(chunk) {
                data.push(chunk);
                length += chunk.length;
            });
            res.on('end', function() {
                req = null;

                if (!datatype) {
                    var contentType = res.headers['content-type'].replace(/\s*;.*$/, '');
                    switch (contentType) {
                        //  FIXME: Что-нибудь еще?
                        case 'text/json':
                        case 'text/x-javascript':
                        case 'application/json':
                        case 'application/x-javascript':
                            datatype = 'json';
                            break;
                    }
                }

                promise.resolve( new de.Result.Raw( Buffer.concat(data, length), datatype ) );
            });
            res.on('close', function(error) {
                req = null;
                promise.reject( de.error({
                    'id': 'HTTP_CONNECTION_CLOSED',
                    'message': error.message
                }) );
            });
        });

        req.on('error', function(error) {
            req = null;
            promise.reject( de.error({
                'id': 'HTTP_UNKNOWN_ERROR',
                'message': error.message
            }) );
        });

        req.end();
    }

};

//  ---------------------------------------------------------------------------------------------------------------  //

