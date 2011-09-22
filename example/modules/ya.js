// ----------------------------------------------------------------------------------------------------------------- //

de.modules.ya = {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {no.Promise} promise
    @param {de.Context} context
*/
de.modules.ya.auth = function(promise, context) {
    var blackboxConfig = de.config['blackbox'];
    var request = context['request'];

    var host = blackboxConfig['host'];
    var path = blackboxConfig['path'] + '?' + node.querystring.stringify({
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
        promise.resolve( new de.Result.Raw(result, true) );
    })
    .else_(function(error) {
        promise.resolve( new de.Result.Error(error) );
    });
};

// ----------------------------------------------------------------------------------------------------------------- //

