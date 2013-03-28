//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Script
//  ---------------------------------------------------------------------------------------------------------------  //

var http_ = require('http');
var fs_ = require('fs');
var path_ = require('path');
var cluster_ = require('cluster');
var os_ = require('os');
var qs_ = require('querystring');

var nopt = require('nopt');

//  ---------------------------------------------------------------------------------------------------------------  //

var de = require('./de.js');

require('./de.block.js');
require('./de.context.js');
require('./de.result.js');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de._modules = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.script = {};

//  ---------------------------------------------------------------------------------------------------------------  //

//  В config можно передать имя файла или готовый объект с конфигом.
//  Или же не передать ничего, тогда будет использованы параметры
//  из командной строки.
//
de.script.init = function(config) {
    config = config || {};
    var options = {};

    if (typeof config == 'string') {
        options = {
            config: config
        };
    }

    var args = nopt(
        {
            port: String,
            socket: String,
            rootdir: String,
            config: String,
            help: Boolean,
            cpus: Number
        },
        {
            'c': [ '--config' ]
        }
    );

    if (args.help) {
        de.script.usage();
    }

    options = no.extend( {}, options, args );

    var basedir;
    if (options.config) {
        config = readConfig(options.config);
        basedir = path_.dirname( path_.resolve(options.config) );
    }
    basedir = basedir || path_.resolve('.');

    config.port = options.port || config.port;
    config.socket = options.socket || config.socket;
    config.cpus = options.cpus || config.cpus;

    if (config.socket) {
        config.socket = path_.resolve(basedir, config.socket);
    }
    config.rootdir = path_.resolve(basedir, options.rootdir || config.rootdir || '.');

    if ( !(config.port || config.socket) ) {
        de.script.usage();
    }

    if (config.modules) {
        readModules(config.modules, basedir);
    }

    de.config = config;
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  FIXME: Унести в de.file?
function readConfig(filename) {
    var content = fs_.readFileSync(filename, 'utf-8');

    return de.eval(content);
};

//  ---------------------------------------------------------------------------------------------------------------  //

function readModules(modules, dirname) {
    for (var id in modules) {
        var filename = path_.join( dirname, modules[id] );

        de._modules[id] = require(filename);
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.script.usage = function() {
    var name = '    ' + path_.basename(require.main.filename);

    console.log('Usage:');
    console.log(name + ' --port 2000 --rootdir test/pages');
    console.log(name + ' --socket descript.sock --rootdir test/pages');
    console.log(name + ' --config test/config.json');
    console.log();

    process.exit(0);
};

//  ---------------------------------------------------------------------------------------------------------------  //

var _server;

de.script.start = function() {
    var cpus = ( de.config.cpus || os_.cpus().length ) - 1;

    if (cluster_.isMaster) {
        console.log('master', process.pid);

        // Fork workers.
        for (var i = 0; i < cpus; i++) {
            var forked = cluster_.fork();
            console.log('forked', forked.process.pid);
        }

        cluster_.on('exit', function(worker, code, signal) {
            console.log('died', worker.process.pid);
            var forked = cluster_.fork();
            console.log('forked', forked.process.pid);
        });

    } else {
        _server = http_.createServer(function(req, res) {
            //  Если это post-запрос, то его параметры приходится получать
            //  асинхронно. Поэтому makeRequest возвращает promise.
            //
            makeRequest(req).then(function(request) {
                var response = new de.Response(res);

                var context = new de.Context(request, response, de.config);

                de.script.onrequest(req, res, context);
            });
        });

        if (de.config.socket) {
            _server.listen(de.config.socket, function() {
                //  FIXME: Опять забыл, зачем нужна эта строчка.
                fs_.chmodSync(this.address(), 0777);
            });
        } else {
            _server.listen(de.config.port, '0.0.0.0', '127.0.0.1');
        }

    }
};

de.script.stop = function() {
    if (_server) {
        _server.close();
        _server = null;
    }

    de.file.unwatch();
};

//  ---------------------------------------------------------------------------------------------------------------  //

function makeRequest(req) {
    var promise = new no.Promise();

    if (req.method === 'POST') {
        var body = '';

        req.on('data', function(data) {
            body += data;
        })
        req.on('end', function() {
            var query = qs_.parse(body);

            promise.resolve( new de.Request(req, query) );
        });
    } else {
        promise.resolve( new de.Request(req) );
    }

    return promise;
};

de.script.onrequest = function(req, res, context) {
    var path = context.request.path || '';
    if ( path.charAt(0) === '/' ) {
        path = path.substr(1);
    }
    path = path || 'index.jsx';

    var block = new de.Block.Include(path);

    block.run(context.request.query, context)
        .then(function(result) {
            if (result instanceof de.Result.Error && result.get('id') === 'FILE_OPEN_ERROR') {
                res.statusCode = 404;
                res.end( result.formatted() );
                return;
            }

            context.response.end(result);
        });
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.sandbox = {};

de.sandbox.block = de.Block.compile;

de.sandbox.http = function(url, options) {
    return new de.Block.Http(url, options);
};

de.sandbox.file = function(filename, options) {
    return new de.Block.File(filename, options);
};

de.sandbox.include = function(filename, options) {
    return new de.Block.Include(filename, options);
};

de.sandbox.call = function(call, options) {
    return new de.Block.Call(call, options);
};

de.sandbox.array = function(array, options) {
    return new de.Block.Array(array, options);
};

de.sandbox.object = function(object, options) {
    return new de.Block.Object(object, options);
};

de.sandbox.value = function(value, options) {
    return new de.Block.Value(value, options);
};

de.sandbox.func = function(func, options) {
    return new de.Block.Function(func, options);
};

de.sandbox.expr = function(expr, options) {
    return new de.Block.Expr(expr, options);
};

//  ---------------------------------------------------------------------------------------------------------------  //

