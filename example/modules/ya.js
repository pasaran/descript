//  ---------------------------------------------------------------------------------------------------------------  //
//  module.ya
//  ---------------------------------------------------------------------------------------------------------------  //

var querystring_ = require('querystring');

var de = require('../../lib/de.js');
var Result = require('../../lib/result.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var ya = {};

//  ---------------------------------------------------------------------------------------------------------------  //

ya.auth = function(descript, promise, context, params) {
    var blackboxConfig = descript.config.blackbox;
    var request = context.request;

    var host = blackboxConfig.host;
    var path = blackboxConfig.path + '?' + querystring_.stringify({
        'method': 'sessionid',
        'userip': request.headers['x-real-ip'],
        'sessionid': request.cookies['Session_id'] || '',
        'host': blackboxConfig['domain'],
        'format': 'json'
    });

    de.http.get(
        {
            'host': host,
            'path': path,
            'port': 80
        }
    )
    .then(function(result) {
        promise.resolve( new Result.Raw(result, true) );
    })
    .else_(function(error) {
        promise.resolve( new Result.Error(error) );
    });
};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = ya;

//  ---------------------------------------------------------------------------------------------------------------  //

