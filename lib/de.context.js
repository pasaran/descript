//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Context
//  ---------------------------------------------------------------------------------------------------------------  //

var de = require('./de.js');

require('./de.request.js');
require('./de.response.js');

var http_ = require('http');
var url_ = require('url');

//  ---------------------------------------------------------------------------------------------------------------  //

/**
    @param {(Object | http_.IncomingMessage)} request
    @param {Object=} extra_params
*/
de.Context = function(request, extra_params) {
    this.config = de.config;

    if (request instanceof http_.IncomingMessage) {
        this.request = new de.Request(request, extra_params);
        this.query = this.request.query;
    } else {
        this.request = null;
        this.query = request;
    }

    this.response = new de.Response();

    this.state = {};
    this.now = Date.now();
};

//  ---------------------------------------------------------------------------------------------------------------  //

/**
    @param {(Object | http_.IncomingMessage)} request
*/
de.Context.create = function(request) {
    var promise = new no.Promise();

    if (
        request.method === 'POST' &&
        de.mime(request.headers) === 'application/x-www-form-urlencoded'
    ) {
        var body = '';

        request.on('data', function(data) {
            body += data;
        })
        request.on('end', function() {
            var extra_params = qs_.parse(body);

            promise.resolve( new de.Context(request, extra_params) );
        });
    } else {
        promise.resolve( new de.Context(request) );
    }

    return promise;
};

//  ---------------------------------------------------------------------------------------------------------------  //

