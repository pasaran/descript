var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File = function(filename, descript, options) {
    this._init(descript, options);

    this.filename = no.jpath.compileString(filename);
};

no.inherit(de.Block.File, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File.prototype._run = function(params, context) {
    var filename = this.filename(params, context);

    return new de.Worker.File(filename, this.datatype);
};

//  ---------------------------------------------------------------------------------------------------------------  //

