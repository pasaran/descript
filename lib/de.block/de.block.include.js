var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var fs_ = require('fs');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Include = function(filename, descript, options) {
    this._init(descript, options);

    this.filename = no.jpath.compileString(filename);
};

no.inherit(de.Block.Include, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

var _cache = {};

de.Block.Include.prototype._run = function(promise, params, context) {
    var filename = this.resolveFilename( this.filename(params, context) );

    var block = _cache[filename];
    if (block) {
        return block.fork(promise, params, context);
    }

    var that = this;
    var descript = this.descript;

    fs_.readFile(filename, function(error, content) {
        if (error) {
            promise.resolve( new de.Result.Error(error) );

        } else {
            try {
                //  FIXME: Защита от модификации sandbox.
                var include = vm_.runInNewContext('(' + content + ')', descript.sandbox, filename);

                var dirname = path_.dirname(filename);

                var options = no.extend( {}, that.options, { dirname: dirname } );
                var block = _cache[filename] = new de.Block.compile(include, descript, options);

                block.fork(promise, params, context, promise);

            } catch (e) {
                promise.resolve( new de.Result.Error({
                    id: 'FILE_EVAL_ERROR',
                    message: e.message
                }) );
                /// throw e;
            }
        }
    });
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.events.on('file-changed', function(e, filename) {
    _cache[filename] = null;
});

//  ---------------------------------------------------------------------------------------------------------------  //

