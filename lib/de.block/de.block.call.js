var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Call = function(call, descript, options) {
    this._init(descript, options);

    var r = call.match(/^(?:(.*?):)?(.*)\(\)$/);

    var module = r[1] || '';
    var method = this.method = r[2];

    module = descript.modules[module];

    call = module[method];
    this.call = (typeof call === 'function') ? call : module;
};

no.inherit(de.Block.Call, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Call.prototype._run = function(params, context) {
    this.call(params, context, this.descript, this.method);
};

//  ---------------------------------------------------------------------------------------------------------------  //

