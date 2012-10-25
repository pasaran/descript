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

de.Block.Function.prototype._run = function(params, context) {
    var result = this.func(context, params);

    var worker = de.Worker();

    //  FIXME: Правильные options.
    var block = new de.Block.compile(result);
    block.run(params, context).then(function(result) {
        worker.promise.resolve(result);
    });

    return worker;
};

//  ---------------------------------------------------------------------------------------------------------------  //

