//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result
//  ---------------------------------------------------------------------------------------------------------------  //

var util_ = require('util');

//  ---------------------------------------------------------------------------------------------------------------  //

var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result = function(result) {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.prototype.string = function() {};

de.Result.prototype.object = function() {};

de.Result.prototype.write = function(stream) {};

de.Result.prototype.formatted = function() {
    return JSON.stringify(this.object(), null, 4);
};


//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Raw = function(result, isJSON) {
    this.result = result;
    this.isJSON = isJSON;
};

util_.inherits(de.Result.Raw, de.Result);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Raw.prototype.write = function(stream) {
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        stream.write( result[i] );
    }
};

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
        o = this._object = (this.isJSON) ? JSON.parse( this.string() ) : this.string();
    }

    return o;
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result.Value
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Value = function(result) {
    this.result = result;
};

util_.inherits(de.Result.Value, de.Result);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Value.prototype.write = function(stream) {
    stream.write( this.string() );
};

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
//  de.Result.Error
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Error = function(error) {
    this.result = {
        'error': error
    };
};

util_.inherits(de.Result.Error, de.Result.Value);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Error.prototype.get = function(field) {
    return this.result.error[field];
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result.Array
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Array = function(result) {
    this.result = result;
};

util_.inherits(de.Result.Array, de.Result);

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
//  de.Result.Object
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Object = function(result) {
    this.result = result;
};

util_.inherits(de.Result.Object, de.Result);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Object.prototype.write = function(stream) {
    stream.write('{');
    var i = 0;
    var result = this.result;
    for (var key in result) {
        if (i++) {
            stream.write(',');
        }
        stream.write( JSON.stringify(key) + ':' );
        result[key].write(stream);
    }
    stream.write('}');
};

de.Result.Object.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        var result = this.result;

        s = '{';
        var i = 0;
        for (var key in result) {
            if (i++) {
                s += ',';
            }
            s += JSON.stringify(key) + ':' + result[key].string();
        }
        s += '}';

        this._string = s;
    }

    return s;
};

de.Result.Object.prototype.object = function() {
    var o = this._object;

    if (!o) {
        var result = this.result;

        o = this._object = {};
        for (var key in result) {
            o[key] = result[key].object();
        }
    }

    return o;
};

//  ---------------------------------------------------------------------------------------------------------------  //

