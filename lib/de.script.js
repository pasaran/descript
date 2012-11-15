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

de.Script = function(config, modules) {
    this.config = config || {};
    this.modules = modules || {};

    this._results = {};
    var includes = this._includes = {};

    no.events.on('file-changed', function(e, filename) {
        includes[filename] = null;
    });

    this._initSandbox();
};

//  ---------------------------------------------------------------------------------------------------------------  //

var _cache = {};

de.Script.prototype.start = function() {

    var config = this.config;
    var that = this;

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
        var server = this.server = http_.createServer(function (req, res) {
            //  FIXME: Выставлять content-type не с потолка.
            //  res.setHeader('Content-Type', 'text/javascript; charset: utf-8');

            var context = new de.Context(req, res, config);

            that.onrequest(req, res, context);

        });

        if (config.socket) {
            server.listen(config.socket);
        } else {
            server.listen(config.port, '0.0.0.0', '127.0.0.1');
        }

    }

};

de.Script.prototype.onrequest = function(req, res, context) {
    var path = context.request.path || '';
    if ( path.charAt(0) === '/' ) {
        path = path.substr(1);
    }
    path = path || 'index.jsx';

    var block = _cache[path];
    if (!block) {
        block = _cache[path] = new de.Block.Include(path, this);
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

de.Script.prototype._initSandbox = function() {
    var sandbox = this.sandbox = {};
    var descript = this;

    sandbox.block = function(block, options) {
        return de.Block.compile(block, descript, options);
    };

    sandbox.http = function(url, options) {
        return new de.Block.Http(url, descript, options);
    };

    sandbox.file = function(filename, options) {
        return new de.Block.File(filename, descript, options);
    };

    sandbox.include = function(filename, options) {
        return new de.Block.Include(filename, descript, options);
    };

    sandbox.call = function(call, options) {
        return new de.Block.Call(call, descript, options);
    };

    sandbox.array = function(array, options) {
        return new de.Block.Array(array, descript, options);
    };

    sandbox.object = function(object, options) {
        return new de.Block.Object(object, descript, options);
    };

    sandbox.value = function(value, options) {
        return new de.Block.Value(value, descript, options);
    };

    sandbox.func = function(func, options) {
        return new de.Block.Function(func, descript, options);
    };

};

//  ---------------------------------------------------------------------------------------------------------------  //

//  FIXME: Унести в de.file?
de.Script.readConfig = function(filename) {
    var content = fs_.readFileSync(filename, 'utf-8');

    return no.de.eval(content);
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Script.readModules = function(modConfig, dirname) {
    modConfig = modConfig || {};

    var modules = {};
    for (var id in modConfig) {
        var filename = path_.join( dirname, modConfig[id] );
        modules[id] = require(filename);
    }

    return modules;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Script.create = function() {

    var options = nopt({
        'port': String,
        'socket': String,
        'rootdir': String,
        'config': String,
        'help': Boolean
    });

    if (options.help) {
        usage();
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
        var modules = de.Script.readModules(config.modules, dirname);
    }

    return new de.Script(config, modules);

    function usage() {
        //  TODO.
        console.log('Usage:');
        console.log('   ./descript --port 2000 --rootdir test/pages');
        console.log('   ./descript --socket descript.sock --rootdir test/pages');
        console.log('   ./descript --config test/config.json');
        console.log();

        process.exit(0);
    }

};

//  ---------------------------------------------------------------------------------------------------------------  //

