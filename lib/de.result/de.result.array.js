var de = require('../de.js');

require('./de.result.js');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Array = function(result) {
    this.result = result;
};

no.inherit(de.Result.Array, de.Result);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Array.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        var result = this.result;

        s = '[';
        for (var i = 0, l = result.length; i < l; i++) {
            if (i) {
                s += ',';
            }
            s += result[i].string();
        }
        s += ']';

        this._string = s;
    }

    return s;
};

de.Result.Array.prototype.object = function() {
    var o = this._object;

    if (!o) {
        var result = this.result;

        o = this._object = [];
        for (var i = 0, l = result.length; i < l; i++) {
            o[i] = result[i].object();
        }
    }

    return o;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Array.prototype.write = function(stream) {
    stream.write('[');
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        if (i) {
            stream.write(',');
        }
        result[i].write(stream);
    }
    stream.write(']');
};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = de.Result.Array;

//  ---------------------------------------------------------------------------------------------------------------  //

