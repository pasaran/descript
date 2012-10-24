var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File = function(filename, descript, options) {
    this._init(descript, options);

    this.filename = no.jpath.compileString(filename);
};

no.inherit( de.Block.File, de.Block );

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File.prototype._run = function(promise, context, params) {
    var filename = this.resolveFilename( this.filename(params, context) );

    no.file.get(filename)
        .then(function(result) {
            //  FIXME: Учесть options.dataType.
            promise.resolve( new de.Result.Raw([ result ], true) );
        })
        .else_(function(error) {
            promise.resolve( new de.Result.Error(error) );
        });
};

//  ---------------------------------------------------------------------------------------------------------------  //

