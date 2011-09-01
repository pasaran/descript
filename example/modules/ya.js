// ----------------------------------------------------------------------------------------------------------------- //

var $querystring = require('querystring');

// ----------------------------------------------------------------------------------------------------------------- //

var Result = require('../../lib/result.js');
var util = require('../../lib/util.js');

// ----------------------------------------------------------------------------------------------------------------- //

var ya = {};

// ----------------------------------------------------------------------------------------------------------------- //

ya.auth = function(promise, context) {
    var blackboxConfig = context.config.blackbox;
    var request = context.request;

    var host = blackboxConfig.host;
    var path = blackboxConfig.path + '?' + $querystring.stringify({
        method: 'sessionid',
        userip: request.headers['x-real-ip'],
        sessionid: request.cookies['Session_id'],
        host: blackboxConfig.domain,
        format: 'json'
    });

    util.http.get( {
        host: host,
        path: path,
        port: 80
    }, function(result) {
        promise.resolve(result);
    } );
};

// ----------------------------------------------------------------------------------------------------------------- //

module.exports = ya;

// ----------------------------------------------------------------------------------------------------------------- //

