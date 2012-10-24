var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Http = function(url, descript, options) {
    this._init(descript, options);

    var ch = url.slice(-1);
    if (ch === '?' || ch === '&') {
        this.extend = true;
        url = url.slice(0, -1);
    }

    this.url = no.jpath.compileString(url);
};

no.inherit(de.Block.Http, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Http.prototype._run = function(params, context) {
    var url = this.url(params, context);

    return new de.Worker.Http(url);
};

//  ---------------------------------------------------------------------------------------------------------------  //

