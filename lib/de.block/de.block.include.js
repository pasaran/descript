var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Include = function(filename, descript, options) {
    this._init(descript, options);

    this.filename = no.jpath.compileString(filename);
};

no.inherit(de.Block.Include, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Include._cache = {};

de.Block.Include.prototype._run = function(promise, context, params) {
    var filename = this.resolveFilename( this.filename(params, context) );

    var block = de.Block.Include._cache[ filename ];
    if (block) {
        block.run(context, params).then(function(result) {
            promise.resolve(result);
        });
        return;
    }

    var that = this;
    var descript = this.descript;

    no.file.get(filename)
        .then(function(result) {
            try {
                //  FIXME: Защита от модификации sandbox.
                var include = vm_.runInNewContext( '(' + result + ')', descript.sandbox, filename);

                var dirname = path_.dirname(filename);

                var options = no.extend( {}, that.options, { dirname: dirname } );
                var block = de.Block.Include._cache[ filename ] = new de.Block.Root(include, descript, options);

                block.run(context, params).then(function(result) {
                    promise.resolve(result);
                });
            } catch (e) {
                promise.resolve( new de.Result.Error({
                    id: 'FILE_EVAL_ERROR',
                    message: e.message,
                    e: e
                }) );
                throw e;
            }
        })
        .else_(function(error) {
            promise.resolve( new de.Result.Error(error) );
        });
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.events.on('file-changed', function(e, filename) {
    delete de.Block.Include._cache[ filename ];
});

//  ---------------------------------------------------------------------------------------------------------------  //

