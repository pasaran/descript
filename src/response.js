// ----------------------------------------------------------------------------------------------------------------- //
// ds.Response
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {nodeServerResponse} response
*/
ds.Response = function(response) {
    this._response = response;

    this.headers = {};
    this.cookies = {};
};

ds.Response.prototype.setHeader = function(name, value) {
    this.headers[name] = value;
};

ds.Response.prototype.setCookie = function(name, value) {
    this.cookies[name] = value;
};

ds.Response.prototype.setStatus = function(status) {
    this.status = status;
};

ds.Response.prototype.setRedirect = function(location) {
    this.location = location;
};

ds.Response.prototype.end = function(result) {
    var response = this._response;

    var headers = this.headers;
    for (var header in headers) {
        response.setHeader(header, headers[header]);
    }

    var cookies = this.cookies;
    var cookie = [];
    for (var name in cookies) {
        cookie.push(name + '=' + cookies[name]);
    }
    response.setHeader('Set-Cookie', cookie); // FIXME: Выставлять expire и т.д.

    if (this.location) {
        response.statusCode = 302;
        response.setHeader('Location', this.location);
        response.end();
        return;
    }

    response.statusCode = this.status || 200;
    result.write(response);
    response.end();
};

// ----------------------------------------------------------------------------------------------------------------- //

