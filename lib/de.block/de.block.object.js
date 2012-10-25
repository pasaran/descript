var de = require('../de.js');

require('./de.block.js');
require('./de.block.array.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Object = function(object, descript, options) {
    this._init(descript, options);

    var items = [];
    var keys = this.keys = [];

    for (var key in object) {
        blocks.push({
            index: i,
            block: de.Block.compile(object[key], descript, options)
        });
        keys.push(key);
    }

    this.groups = this._groupItems(items);
};

no.inherit(de.Block.Object, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Object.prototype._groupItems = de.Block.Array.prototype._groupItems;
de.Block.Object.prototype._run = de.Block.Array.prototype._run;

de.Block.Object.prototype._getResult = function(results) {
    var keys = this.keys;

    var r = {};

    for (var i = 0, l = results.length; i < l; i++) {
        r[ keys[i] ] = results[i];
    }

    return new de.Result.Object(r);
};

//  ---------------------------------------------------------------------------------------------------------------  //

