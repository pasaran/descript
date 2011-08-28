// ----------------------------------------------------------------------------------------------------------------- //

var $querystring = require('querystring');

// ----------------------------------------------------------------------------------------------------------------- //

var config = global.config || {};

// ----------------------------------------------------------------------------------------------------------------- //

var Result = require('../../lib/result.js');
var util = require('../../lib/util.js');

// ----------------------------------------------------------------------------------------------------------------- //

var ya = {};

// ----------------------------------------------------------------------------------------------------------------- //

ya.auth = function(promise, context) {
    var host = config.blackbox.host;
    var path = config.blackbox.path + '?' + $querystring.stringify({
        method: 'sessionid',
        userip: context.headers['x-real-ip'],
        sessionid: context.cookies['Session_id'],
        host: config.blackbox.domain,
        format: 'json'
    });

    util.httpGet( {
        host: host,
        path: path,
        port: 80
    }, function(error, result) {
        if (error) {
            promise.resolve( new Result.Value(error) );
        } else {
            promise.resolve( new Result(result.data) );
        }
    } );
};

// ----------------------------------------------------------------------------------------------------------------- //

module.exports = ya;

// ----------------------------------------------------------------------------------------------------------------- //

