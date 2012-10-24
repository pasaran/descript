var de = require('../de.js');

require('./de.result.js');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Raw = function(result, datatype) {
    this.result = result;
    this.datatype = datatype;
};

no.inherit(de.Result.Raw, de.Result);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Raw.prototype.string = function() {
    var s = this._string;

    if (!s) {
        s = this._string = this.result.join('');
    }

    return s;
};

de.Result.Raw.prototype.object = function() {
    var o = this._object;

    if (!o) {
        o = this._object = (this.datatype === 'json') ? JSON.parse( this.string() ) : this.string();
    }

    return o;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Raw.prototype.write = function(stream) {
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        stream.write( result[i] );
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = de.Result.Raw;

//  ---------------------------------------------------------------------------------------------------------------  //

