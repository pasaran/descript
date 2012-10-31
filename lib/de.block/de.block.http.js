var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var url_ = require('url');
var http_ = require('http');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Http = function(url, descript, options) {
    this._init(descript, options);

    var ch = url.slice(-1);
    if (ch === '?' || ch === '&') {
        this.extend = true;
        url = url.slice(0, -1);
    }

    this.url = no.jpath.compileString(url);
    this.datatype = options.datatype;
};

no.inherit(de.Block.Http, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Http.prototype._run = function(promise, params, context) {
    var url = this.url(params, context);

    var worker = (new no.Promise() )
        .then(function(result) {
            promise._request = null;
            promise.resolve( new de.Result.Raw(result, datatype) );
        })
        .else_(function(error) {
            promise._request = null;
            promise.resolve( new de.Result.Error(error) );
        })
        .on('abort', function() {
            if (this._request) {
                this._request.abort();
                //  FIXME: Нужно ли это?
                this._request = null;
            }
        });
        //  FIXME: В какой момент нужно сделать worker.off('abort')?
        //  Или это не нужно совсем?

    promise.forward('abort', worker);

    var options = url_.parse(url, true, true);
    if (this.extend) {
        no.extend(options.query, params);
    }

    run(options, worker, 0);
};


// ----------------------------------------------------------------------------------------------------------------- //

var errorMessages = {
    '400': 'Bad Request',
    '403': 'Forbidden',
    '404': 'Not Found',
    '500': 'Internal Server Error',
    '503': 'Service Unavailable'
};

//  ---------------------------------------------------------------------------------------------------------------  //

function run(options, promise, count) {
    var data = [];

    var req = promise._request = http_.request(options, function(res) {
        var status = res.statusCode;

        var error;
        switch (status) {
            //  TODO: Кэшировать 301 запросы.
            case 301:
            case 302:
                //  FIXME: MAX_REDIRECTS.
                if (count > 3) {
                    return promise.resolve({
                        'id': 'HTTP_TOO_MANY_REDIRECTS'
                    });
                }

                var location = res.headers['location'] || '';
                var redirect = url_.resolve(options.href, location);

                options = url_.parse(redirect, true, true);

                return run(options, promise, count + 1);

            case 400:
            case 403:
            case 404:
            case 500:
            case 503:
                return promise.resolve({
                    'id': 'HTTP_' + status,
                    'message': errorMessages[status]
                });

            //  TODO: default:
        }

        res.on('data', function(chunk) {
            data.push(chunk);
        });
        res.on('end', function() {
            promise.resolve(data);
        });
        res.on('close', function(error) {
            promise.resolve({
                'id': 'HTTP_CONNECTION_CLOSED',
                'message': error.message
            });
        });

    });

    req.on('error', function(error) {
        promise.resolve({
            'id': 'HTTP_UNKNOWN_ERROR',
            'message': error.message
        });
    });

    req.end();
};

//  ---------------------------------------------------------------------------------------------------------------  //

