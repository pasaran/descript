var de = require('../de.js');

require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var url_ = require('url');
var http_ = require('http');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Worker.Http = function() {
    this._promise = new no.Promise();
    this._request = null;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Worker.Http.prototype.run = function(url, params) {
    var options = url_.parse(url, true);

    var that = this;

    var promise = ( new no.Promise() )
        .then(function(result) {
            that._promise.resolve( new de.Result.Raw(result) );
            that._request = null;
        })
        .else_(function(error) {
            that._promise.resolve( new de.Result.Error(error) );
            that._request = null;
        });

    if (params) {
        no.extend(options.query, params);
    }

    this._run(options, promise, 0);

    return this;

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

                return this._run(redirect, count + 1);

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
            that.promise.reject(error);

        } else {
            res.on('data', function(chunk) {
                data.push(chunk);
            });
            res.on('end', function() {
                that.promise.resolve(data);
            });
            res.on('close', function(error) {
                that.promise.reject({
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
        this._request.abort();
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = de.Worker.Http;

//  ---------------------------------------------------------------------------------------------------------------  //

