var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var path_ = require('path');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File = function(filename, descript, options) {
    this._init(descript, options);

    this.filename = no.jpath.compileString(filename);
    this.datatype = options.datatype;
};

no.inherit(de.Block.File, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File.prototype._run = function(params, context) {
    var filename = this.filename(params, context);

    var datatype = this.datatype;
    if (!datatype) {
        var ext = path_.extname(filename);

        switch (ext) {
            case '.json':
                datatype = 'json';
                break;
        }
    }


    return new de.Worker.File(filename, datatype);
};

//  ---------------------------------------------------------------------------------------------------------------  //

