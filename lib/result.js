//  ---------------------------------------------------------------------------------------------------------------  //
//  Result
//  ---------------------------------------------------------------------------------------------------------------  //

var util_ = require('util');

//  ---------------------------------------------------------------------------------------------------------------  //

var Result = function(result) {};

//  ---------------------------------------------------------------------------------------------------------------  //

Result.prototype.string = function() {};

Result.prototype.object = function() {};

Result.prototype.write = function(stream) {};

Result.prototype.formatted = function() {
    return JSON.stringify(this.object(), null, '    ');
};


//  ---------------------------------------------------------------------------------------------------------------  //

Result.Raw = function(result, isJSON) {
    this.result = result;
    this.isJSON = isJSON;
};

util_.inherits(Result.Raw, Result);

//  ---------------------------------------------------------------------------------------------------------------  //

Result.Raw.prototype.write = function(stream) {
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        stream.write( result[i] );
    }
};

Result.Raw.prototype.string = function() {
    var s = this._string;

    if (!s) {
        s = this._string = this.result.join('');
    }

    return s;
};

Result.Raw.prototype.object = function() {
    var o = this._object;

    if (!o) {
        o = this._object = (this.isJSON) ? JSON.parse( this.string() ) : this.string();
    }

    return o;
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Result.Value
//  ---------------------------------------------------------------------------------------------------------------  //

Result.Value = function(result) {
    this.result = result;
};

util_.inherits(Result.Value, Result);

//  ---------------------------------------------------------------------------------------------------------------  //

Result.Value.prototype.write = function(stream) {
    stream.write( this.string() );
};

Result.Value.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        s = this._string = JSON.stringify( this.result );
    }

    return s;
};

Result.Value.prototype.object = function() {
    return this.result;
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Result.Error
//  ---------------------------------------------------------------------------------------------------------------  //

Result.Error = function(error) {
    this.result = {
        'error': error
    };
};

util_.inherits(Result.Error, Result.Value);

//  ---------------------------------------------------------------------------------------------------------------  //

Result.Error.prototype.get = function(field) {
    return this.result.error[field];
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Result.Array
//  ---------------------------------------------------------------------------------------------------------------  //

Result.Array = function(result) {
    this.result = result;
};

util_.inherits(Result.Array, Result);

//  ---------------------------------------------------------------------------------------------------------------  //

Result.Array.prototype.write = function(stream) {
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

Result.Array.prototype.string = function() {
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

Result.Array.prototype.object = function() {
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
//  Result.Object
//  ---------------------------------------------------------------------------------------------------------------  //

Result.Object = function(result) {
    this.result = result;
};

util_.inherits(Result.Object, Result);

//  ---------------------------------------------------------------------------------------------------------------  //

Result.Object.prototype.write = function(stream) {
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

Result.Object.prototype.string = function() {
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

Result.Object.prototype.object = function() {
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

module.exports = Result;

//  ---------------------------------------------------------------------------------------------------------------  //

