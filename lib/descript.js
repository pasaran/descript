//  ---------------------------------------------------------------------------------------------------------------  //
//  Descript
//  ---------------------------------------------------------------------------------------------------------------  //

var http_ = require('http');

//  ---------------------------------------------------------------------------------------------------------------  //

var Block = require('./block.js');
var Context = require('./context.js');
var Result = require('./result.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var Descript = function(config, modules) {
    this.config = config || {};
    this.modules = modules || {};

    this._initSandbox();
};

//  ---------------------------------------------------------------------------------------------------------------  //

Descript.prototype.start = function() {

    var config = this.config;

    var server = this.servier = http_.createServer(function (req, res) {
        //  res.setHeader('Content-Type', 'text/javascript; charset: utf-8');

        var context = new Context(req, res, config);

        var path = context.request.path;
        if (path === '/') {
            path = '/index.jsx';
        }

        var block = new Block.Root(path);
        block.run(context).then(function(result) {
            if (result instanceof Result.Error && result.get('id') === 'FILE_OPEN_ERROR') {
                res.statusCode = 404;
                res.end( result.formatted() );
                return;
            }

            // context.response.end( result.string() );
            // context.response.end( result.formatted() ); // FIXME: Для красоты временно форматируем ответ.
            context.response.end(result);
        });
    });

    server.listen(config.port, '127.0.0.1');

};

//  ---------------------------------------------------------------------------------------------------------------  //

Descript.prototype._initSandbox = function() {
    var config = this.config;

    var sandbox = this.sandbox = {};
    var descript = this;

    sandbox.http = function(url, options) {
        return new Block.Http(url, descript, options);
    };

    sandbox.file = function(filename, options) {
        return new Block.File(filename, descript, options);
    };

    sandbox.include = function(filename, options) {
        return new Block.Include(filename, descript, options);
    };

    sandbox.call = function(call, options) {
        return new Block.Call(call, descript, options);
    };

    sandbox.array = function(array, options) {
        return new Block.Array(array, descript, options);
    };

    sandbox.object = function(object, options) {
        return new Block.Object(object, descript, options);
    };

    sandbox.value = function(value, options) {
        return new Block.Value(value, descript, options);
    };

    sandbox.func = function(func, options) {
        return new Block.Function(func, descript, options);
    };

};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = Descript;

//  ---------------------------------------------------------------------------------------------------------------  //

