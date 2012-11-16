//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Script
//  ---------------------------------------------------------------------------------------------------------------  //

var http_ = require('http');
var fs_ = require('fs');
var path_ = require('path');
var cluster_ = require('cluster');
var os_ = require('os');

var nopt = require('nopt');

//  ---------------------------------------------------------------------------------------------------------------  //

var de = require('./de.js');

require('./de.block.js');
require('./de.context.js');
require('./de.result.js');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var numCPUs = os_.cpus().length;

//  ---------------------------------------------------------------------------------------------------------------  //

var _results = {};

var _includes = {};
var _files = {};
var _pages = {};

de._modules = {};

//  ---------------------------------------------------------------------------------------------------------------  //

no.events.on('file-changed', function(e, filename) {
    _includes[filename] = null;
});

//  ---------------------------------------------------------------------------------------------------------------  //

de.script.init = function(config) {

    var options = nopt({
        'port': String,
        'socket': String,
        'rootdir': String,
        'config': String,
        'help': Boolean
    });

    if (options.help) {
        de.usage();
    }

    var config;
    var basedir;
    if (options.config) {
        config = de.Script.readConfig(options.config);
        basedir = path_.dirname( path_.resolve(options.config) );
    } else {
        config = {};
        basedir = path_.resolve('.');
    }

    config.port = options.port || config.port;
    config.socket = options.socket || config.socket;
    config.rootdir = path_.resolve(basedir, options.rootdir || config.rootdir || '.' );

    if ( !(config.port || config.socket) ) {
        usage();
    }

    if (config.modules) {
        var dirname = path_.dirname( path_.resolve(options.config) );
        readModules(config.modules, dirname);
    }

    return config;
};

//  ---------------------------------------------------------------------------------------------------------------  //

var _server;

de.script.start = function() {
    if (cluster_.isMaster) {
        // Fork workers.
        for (var i = 0; i < numCPUs; i++) {
            cluster_.fork();
        }

        cluster_.on('exit', function(worker, code, signal) {
            //  console.log('worker ' + worker.process.pid + ' died');
            cluster_.fork();
        });

    } else {
        _server = http_.createServer(function (req, res) {
            //  FIXME: Выставлять content-type не с потолка.
            //  res.setHeader('Content-Type', 'text/javascript; charset: utf-8');

            var context = new de.Context(req, res, de.config);

            de.script.onrequest(req, res, context);
        });

        if (de.config.socket) {
            server.listen(de.config.socket);
        } else {
            server.listen(de.config.port, '0.0.0.0', '127.0.0.1');
        }

    }
};

de.script.stop = function() {
    if (_server) {
        _server.close();
        _server = null;
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

function onrequest(req, res, context) {
    var path = context.request.path || '';
    if ( path.charAt(0) === '/' ) {
        path = path.substr(1);
    }
    path = path || 'index.jsx';

    var block = _cache[path];
    if (!block) {
        block = _cache[path] = new de.Block.Include(path);
    }

    //  FIXME: Как это побороть? Этому блоку прилетает дефолтный таймаут,
    //  но если блок внутри устанавливает себе больший таймаут, то все равно отрабатывает дефолтный.
    block.timeout = 1000000;
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

//  ---------------------------------------------------------------------------------------------------------------  //

//  FIXME: Унести в de.file?
de.Script.readConfig = function(filename) {
    var content = fs_.readFileSync(filename, 'utf-8');

    return no.de.eval(content);
};

//  ---------------------------------------------------------------------------------------------------------------  //

function readModules(modConfig, dirname) {
    modConfig = modConfig || {};

    var modules = {};
    for (var id in modConfig) {
        var filename = path_.join( dirname, modConfig[id] );
        modules[id] = require(filename);
    }

    return modules;
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

