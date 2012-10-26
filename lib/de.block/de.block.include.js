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

de.Block.Include.prototype._run = function(params, context) {
    var filename = this.resolveFilename( this.filename(params, context) );

    var block = _cache[filename];
    if (block) {
        return block.run(params, context);
    }

    var that = this;
    var descript = this.descript;

    //  FIXME: Унести это в de.Worker.Include.
    fs_.readFile(filename, function(error, content) {
        if (error) {
            return new de.Worker.Error(error);

        } else {
            try {
                //  FIXME: Защита от модификации sandbox.
                var include = vm_.runInNewContext( '(' + content + ')', descript.sandbox, filename);

                var dirname = path_.dirname(filename);

                var options = no.extend( {}, that.options, { dirname: dirname } );
                var block = _cache[ filename ] = new de.Block.compile(include, descript, options);

                return block.run(context, params);

            } catch (e) {
                return new de.Worker.Error({
                    id: 'FILE_EVAL_ERROR',
                    message: e.message
                });
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

