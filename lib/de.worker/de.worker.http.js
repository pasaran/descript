var de = require('../de.js');

require('./de.worker.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var url_ = require('url');
var http_ = require('http');

//  ---------------------------------------------------------------------------------------------------------------  //

/**
    @constructor
    @param {Object} options Объект, полученный из url.parse(). См. http://nodejs.org/api/url.html#url_url
    @param {String} datatype Строка с предполагаемым типом ответа. В данный момент может быть 'json' и все остальное ('text').
*/
de.Worker.Http = function(options, datatype) {
    this.promise = new no.Promise();
    this._request = null;

    var that = this;

    var promise = ( new no.Promise() )
        .then(function(result) {
            that.promise.resolve( new de.Result.Raw(result, datatype) );
            that._request = null;
        })
        .else_(function(error) {
            that.promise.resolve( new de.Result.Error(error) );
            that._request = null;
        });

    this._run(options, promise, 0);
};

no.extend(de.Worker.Http, de.Worker);

// ----------------------------------------------------------------------------------------------------------------- //

var errorMessages = {
    '400': 'Bad Request',
    '403': 'Forbidden',
    '404': 'Not Found',
    '500': 'Internal Server Error',
    '503': 'Service Unavailable'
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Worker.Http.prototype._run = function(options, promise, count) {
    var data = [];

    var that = this;

    var req = this._request = http_.request(options, function(res) {
        var status = res.statusCode;

        var error;
        switch (status) {
            //  TODO: Кэшировать 301 запросы.
            case 301:
            case 302:
                if (count > 3) { // FIXME: MAX_REDIRECTS.
                    return promise.reject({
                        'id': 'HTTP_TOO_MANY_REDIRECTS'
                    });
                }

                var location = res.headers['location'] || '';
                var redirect = url_.resolve(options.href, location);

                return that._run( url_.parse(redirect, true), promise, count + 1 );

            case 400:
            case 403:
            case 404:
            case 500:
            case 503:
                error = {
                    'id': 'HTTP_' + status,
                    'message': errorMessages[status]
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
    });

    req.on('error', function(error) {
        promise.reject({
            'id': 'HTTP_UNKNOWN_ERROR',
            'message': error.message
        });
    });

    req.end();
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Worker.Http.prototype.abort = function() {
    if (this._request) {
        /*
        //  FIXME: Непонятно, нужно ли это делать?
        this.promise.resolve( new de.Result.Error({
            id: 'HTTP_REQUEST_ABORTED'
        }) );
        */
        this._request.abort();
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = de.Worker.Http;

//  ---------------------------------------------------------------------------------------------------------------  //

