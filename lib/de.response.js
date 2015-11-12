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

function escapeHeader(header) {
    return header
        .replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])+/g, encodeURI) // валидные суррогатные пары
        .replace(/[\uD800-\uDFFF]/g, '')                          // невалидные половинки суррогатных пар
        .replace(/[\u0000-\u001F\u007F-\uFFFF]+/g, encodeURI);    // всё остальное непечатное
}

de.Response.prototype.end = function(response, result) {
    var headers = this.headers;
    for (var header in headers) {
        response.setHeader( header, escapeHeader(headers[header]) );
    }

    var cookies = this.cookies;
    var cookie = [];
    for (var name in cookies) {
        cookie.push(escapeHeader(name + '=' + cookies[name]));
    }
    response.setHeader('Set-Cookie', cookie); // FIXME: Выставлять expire и т.д.

    if (this.location) {
        response.statusCode = 302;
        response.setHeader('Location', escapeHeader(this.location));
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

