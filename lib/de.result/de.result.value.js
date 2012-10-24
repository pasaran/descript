var de = require('../de.js');

require('./de.result.js');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Value = function(result) {
    this.result = result;
};

no.inherit(de.Result.Value, de.Result);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Value.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        s = this._string = JSON.stringify( this.result );
    }

    return s;
};

de.Result.Value.prototype.object = function() {
    return this.result;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Value.prototype.write = function(stream) {
    stream.write( this.string() );
};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = de.Result.Value;

//  ---------------------------------------------------------------------------------------------------------------  //

