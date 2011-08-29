// ----------------------------------------------------------------------------------------------------------------- //

var $http = require('http');
var $url = require('url');
var $path = require('path');

// ----------------------------------------------------------------------------------------------------------------- //

var config = global.config = require('./config.js');

config.rootdir = $path.resolve('pages');

// ----------------------------------------------------------------------------------------------------------------- //

var modules = global.modules = {
    ya: require('./modules/ya.js')
};

// ----------------------------------------------------------------------------------------------------------------- //

var Block = require('../lib/block.js');
var util = require('../lib/util.js');

// ----------------------------------------------------------------------------------------------------------------- //

var server = $http.createServer( function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset: utf-8' });

    var url = $url.parse( req.url, true );

    var headers = req.headers;
    var cookies = util.parseCookies( headers['cookie'] || '' );

    var context = {
        state: {},
        request: url.query,
        headers: headers,
        cookies: cookies,
        config: config
    };

    var path = url.pathname;
    if (path === '/') {
        path = '/index.jsx';
    }

    var block = new Block.Root(path);
    block.run(context).then(function(result) {
        res.end( JSON.stringify( result.object(), null, '    ') );
    });
});

server.listen(config.port, '127.0.0.1');

// ----------------------------------------------------------------------------------------------------------------- //

