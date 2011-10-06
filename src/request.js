// ----------------------------------------------------------------------------------------------------------------- //
// ds.Request
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {nodeServerRequest} request
*/
ds.Request = function(request) {
    this.headers = request.headers;
    this.cookies = ds.util.parseCookies( this.headers['cookie'] || '' );

    var url = node.url.parse( request.url, true );

    this['query'] = url.query;
    this.path = url.pathname;
};

