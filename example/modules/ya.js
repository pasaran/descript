// ----------------------------------------------------------------------------------------------------------------- //

ds.modules['ya'] = {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {no.Promise} promise
    @param {ds.Context} context
    @param {!Object} params
*/
ds.modules['ya']['auth'] = function(promise, context, params) {
    var blackboxConfig = ds.config['blackbox'];
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
        promise.resolve( new ds.Result.Raw(result, true) );
    })
    .else_(function(error) {
        promise.resolve( new ds.Result.Error(error) );
    });
};

// ----------------------------------------------------------------------------------------------------------------- //

