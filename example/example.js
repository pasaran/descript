// ----------------------------------------------------------------------------------------------------------------- //

/** @type {nodeProgram} */
var program = require('../deps/commander.js');

program
    .version('0.0.1')
    .option('-r, --rootdir <dir>', 'Root directory', './pages')
    .parse(process.argv);

var cwd = process.cwd();

ds.config['rootdir'] = node.path.resolve( cwd, program['rootdir'] );

// ----------------------------------------------------------------------------------------------------------------- //

var server = node.http.createServer( function (/** @type {nodeServerRequest} */ req, /** @type {nodeServerResponse} */ res) {
    res.setHeader( 'Content-Type', 'text/javascript; charset: utf-8' );

    var context = new ds.Context(req, res, ds.config);

    var path = context['request'].path;
    if (path === '/') {
        path = '/index.jsx';
    }

    var block = new ds.Block.Root(path);
    block.run(context).then(function(result) {
        if (result instanceof ds.Result.Error && result.get('id') === 'FILE_OPEN_ERROR') {
            res.statusCode = 404;
            res.end( result.formatted() );
            return;
        }

        // context.response.end( result.string() );
        // context.response.end( result.formatted() ); // FIXME: Для красоты временно форматируем ответ.
        context['response'].end(result);
    });
});

server.listen(ds.config.port, '127.0.0.1');

// ----------------------------------------------------------------------------------------------------------------- //

