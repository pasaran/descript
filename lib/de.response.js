//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Response
//  ---------------------------------------------------------------------------------------------------------------  //

var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Response = function() {
    //  FIXME: Кажется тут должен быть массив, а не объект.
    //  Вполне может быть несколько одинаковых заголовков.
    this.headers = {};

    this.cookies = {};

    this.status = 200;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Response.prototype.setHeader = function(name, value) {
    this.headers[name] = value;
};

//  FIXME: Expires, encoding, ...
de.Response.prototype.setCookie = function(name, value) {
    this.cookies[name] = value;
};

de.Response.prototype.setStatus = function(status) {
    this.status = status;
};

de.Response.prototype.setRedirect = function(location) {
    this.location = location;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Response.prototype.end = function(response, result) {
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

    response.statusCode = this.status;

    if (result) {
        /*
        var content_type = result.content_type;
        if (result.data_type !== 'binary') {
            content_type += '; charset=utf-8';
        }
        */
        response.setHeader( 'Content-Type', result.contentType() );

        result.write(response);
        response.end();
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Response.prototype.end = function(response, result) {
    var headers = this.headers;
    for (var header in headers) {
        response.setHeader( header, headers[header] );
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

    response.statusCode = this.status;

    if (result) {
        response.setHeader( 'Content-Type', result.contentType() );

        result.write(response);
        response.end();
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

