var $url = require('url');

var util = require('./util.js');

var Request = function(request) {
    this.headers = request.headers;
    this.cookies = util.parseCookies( this.headers['cookie'] || '' );

    var url = $url.parse( request.url, true );

    this.query = url.query;
    this.path = url.pathname;
};

module.exports = Request;
