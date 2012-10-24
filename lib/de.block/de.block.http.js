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

de.Block.Http.prototype._run = function(promise, context, params) {
    var url = this.url(params, context);
    var query = (this.extend) ? params : null;

    var req = no.http.get(url, query)
        .then(function(result) {
            promise.resolve( new de.Result.Raw(result, true) ); // FIXME: Учесть options.dataType.
        })
        .else_(function(error) {
            promise.resolve( new de.Result.Error(error) );
        });

    promise.else_(function(error) {
        req.abort();
    });

};

//  ---------------------------------------------------------------------------------------------------------------  //

