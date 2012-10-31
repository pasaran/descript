var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Function = function(func, descript, options) {
    this._init(descript, options);

    this.func = func;
};

no.inherit(de.Block.Function, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Function.prototype._run = function(promise, params, context) {
    var result = this.func(context, params);

    //  FIXME: Правильные options.
    var block = new de.Block.compile(result);

    block.fork(promise, params, context);
};

//  ---------------------------------------------------------------------------------------------------------------  //

