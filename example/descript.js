// ----------------------------------------------------------------------------------------------------------------- //

/** @type {nodeProgram} */
var program = require('../deps/commander.js');

program
    .version('0.0.1')
    .option('-r, --rootdir <dir>', 'Root directory', '.')
    .parse(process.argv);

var cwd = process.cwd();

de.config['rootdir'] = node.path.resolve( cwd, program['rootdir'] );

// ----------------------------------------------------------------------------------------------------------------- //

var server = node.http.createServer( function (/** @type {nodeServerRequest} */ req, /** @type {nodeServerResponse} */ res) {
    res.setHeader( 'Content-Type', 'text/javascript; charset: utf-8' );

    var context = new de.Context(req, res, de.config);

    var path = context['request'].path;
    if (path === '/') {
        path = '/index.jsx';
    }

    var block = new de.Block.Root(path);
    block.run(context).then(function(result) {
        if (result instanceof de.Result.Error && result.get('id') === 'FILE_OPEN_ERROR') {
            res.statusCode = 404;
            res.end( result.formatted() );
            return;
        }

        // context.response.end( result.string() );
        // context.response.end( result.formatted() ); // FIXME: Для красоты временно форматируем ответ.
        result.write(res);
        res.end();
    });
});

server.listen(de.config.port, '127.0.0.1');

// ----------------------------------------------------------------------------------------------------------------- //

