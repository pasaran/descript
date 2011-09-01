// ----------------------------------------------------------------------------------------------------------------- //

var $http = require('http');
var $url = require('url');
var $path = require('path');

// ----------------------------------------------------------------------------------------------------------------- //

var program = require('./deps/commander.js');

program
    .version('0.0.1')
    .option('-c, --config <path>', 'Path to config', 'config.js')
    .option('-r, --rootdir <dir>', 'Root directory', '.')
    .parse(process.argv);

var cwd = process.cwd();

var config;
try {
    var configPath = $path.resolve( cwd, program.config );
    config = global.config = require(configPath);
} catch (e) {
    console.log( program.helpInformation() );
    console.log( 'ERROR: Cannot open config file:', configPath, '\n' );
    process.exit(1);
}

config.rootdir = $path.resolve( cwd, program.rootdir );

// ----------------------------------------------------------------------------------------------------------------- //

var modules = global.modules = {
    ya: require('./example/modules/ya.js')
};

// ----------------------------------------------------------------------------------------------------------------- //

var util = require('./lib/util.js');

var Block = require('./lib/block.js');
var Result = require('./lib/result.js');
var Context = require('./lib/context.js');

// ----------------------------------------------------------------------------------------------------------------- //

var server = $http.createServer( function (req, res) {
    res.setHeader( 'Content-Type', 'text/javascript; charset: utf-8' );

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
        context.response.end( result.formatted() ); // FIXME: Для красоты временно форматируем ответ.
    });
});

server.listen(config.port, '127.0.0.1');

// ----------------------------------------------------------------------------------------------------------------- //

