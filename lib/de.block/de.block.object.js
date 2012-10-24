var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Object = function(object, descript, options) {
    this._init(descript, options);

    var blocks = this.blocks = [];
    var keys = this.keys = [];

    for (var key in object) {
        blocks.push( de.Block.compile(object[key], descript, options) );
        keys.push(key);
    }
};

no.inherit( de.Block.Object, de.Block );

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Object.prototype.subblocks = de.Block.Array.prototype.subblocks;

de.Block.Object.prototype.setPriority = de.Block.Array.prototype.setPriority;

de.Block.Object.prototype.getResult = function(result) {
    var blocks = this.blocks;
    var keys = this.keys;

    var r = {};

    for (var i = 0, l = blocks.length; i < l; i++) {
        r[ keys[i] ] = blocks[i].getResult(result);
    }

    return new de.Result.Object(r);
};

//  ---------------------------------------------------------------------------------------------------------------  //

