/**
    @constructor
    @param {nodeServerRequest} request
*/
de.Request = function(request) {
    this.headers = request.headers;
    this.cookies = de.util.parseCookies( this.headers['cookie'] || '' );

    var url = node.url.parse( request.url, true );

    this['query'] = url.query;
    this.path = url.pathname;
};

