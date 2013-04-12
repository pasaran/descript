var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var os_ = require('os');
var cluster_ = require('cluster');
var path_ = require('path');
var http_ = require('http');
var fs_ = require('fs');

//  ---------------------------------------------------------------------------------------------------------------  //

de.server = {};

//  ---------------------------------------------------------------------------------------------------------------  //

var _server;

//  ---------------------------------------------------------------------------------------------------------------  //

de.server.init = function(config) {
    config = de.script.init(config);

    if ( !(config.port || config.socket) || config.help ) {
        usage();
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

function usage() {
    var name = '    ' + path_.basename(require.main.filename);

    console.log('Usage:');
    console.log(name + ' --port 2000 --rootdir test/pages');
    console.log(name + ' --socket descript.sock --rootdir test/pages');
    console.log(name + ' --config test/config.json');
    console.log();

    process.exit(0);
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.server.start = function() {
    var workers = de.config.workers || ( os_.cpus().length - 1 );

    if (cluster_.isMaster) {
        console.log('master', process.pid);

        // Fork workers.
        for (var i = 0; i < workers; i++) {
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
            //  асинхронно. Поэтому de.Context.create() возвращает promise.
            //
            de.Context.create(req).done(function(context) {
                de.server.onrequest(req, res, context);
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

//  ---------------------------------------------------------------------------------------------------------------  //

de.server.stop = function() {
    if (_server) {
        _server.close();
        _server = null;
    }

    de.file.unwatch();
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.server.onrequest = function(req, res, context) {
    var path = context.request.url.pathname || '';
    if ( path.charAt(0) === '/' ) {
        path = path.substr(1);
    }
    path = path || 'index.jsx';

    var block = new de.Block.Include(path);

    block.run(context.query, context)
        .done(function(result) {
            if (result instanceof de.Result.Error && result.get('id') === 'FILE_OPEN_ERROR') {
                res.statusCode = 404;
                res.end( result.formatted() );
                return;
            }

            context.response.end(res, result);
        });
};

//  ---------------------------------------------------------------------------------------------------------------  //

