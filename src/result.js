// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {*} result
*/
ds.Result = function(result) {};

/**
    @return {string}
*/
ds.Result.prototype.string = function() {};

/**
    @return {number|boolean|string|Object}
*/
ds.Result.prototype.object = function() {};

/**
    @param {node.Stream} stream
*/
ds.Result.prototype.write = function(stream) {};

/**
    @return {string}
*/
ds.Result.prototype.formatted = function(path) {
    var obj = path ? no.path(path, this.object()) : this.object();
    return JSON.stringify(obj, null, 4);
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @type {Object.<string, { timestamp: number, promise: no.Promise }>}
*/
ds.Result._cache = {};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result.Raw
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result}
    @param {Array.<node.Buffer>} result
    @param {boolean|undefined} isJSON
*/
ds.Result.Raw = function(result, isJSON) {
    this.result = result;
    this.isJSON = isJSON;
};

node.util.inherits( ds.Result.Raw, ds.Result );

/** @override */
ds.Result.Raw.prototype.write = function(stream) {
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        stream.write( result[i] );
    }
};

/** @override */
ds.Result.Raw.prototype.string = function() {
    var s = this._string;

    if (!s) {
        s = this._string = this.result.join('');
    }

    return s;
};

/** @override */
ds.Result.Raw.prototype.object = function() {
    var o = this._object;

    if (!o) {
        o = this._object = (this.isJSON) ? JSON.parse( this.string() ) : this.string();
    }

    return o;
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result.Value
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result}
    @param {number|boolean|string|Object} result
*/
ds.Result.Value = function(result) {
    this.result = result;
};

node.util.inherits( ds.Result.Value, ds.Result );

/** @override */
ds.Result.Value.prototype.write = function(stream) {
    stream.write( this.string() );
};

/** @override */
ds.Result.Value.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        s = this._string = JSON.stringify( this.result );
    }

    return s;
};

/** @override */
ds.Result.Value.prototype.object = function() {
    return this.result;
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result.Error
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result.Value}
    @param {!Object} error
*/
ds.Result.Error = function(error) {
    this.result = {
        'error': error
    };
};

node.util.inherits( ds.Result.Error, ds.Result.Value );

/**
    @param {string} field
    @return {*}
*/
ds.Result.Error.prototype.get = function(field) {
    return this.result.error[field];
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result.Array
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result}
    @param {Array} result
*/
ds.Result.Array = function(result) {
    this.result = result;
};

node.util.inherits( ds.Result.Array, ds.Result );

/** @override */
ds.Result.Array.prototype.write = function(stream) {
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

/** @override */
ds.Result.Array.prototype.string = function() {
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

/** @override */
ds.Result.Array.prototype.object = function() {
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

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result.Object
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result}
    @param {!Object} result
*/
ds.Result.Object = function(result) {
    this.result = result;
};

node.util.inherits( ds.Result.Object, ds.Result );

/** @override */
ds.Result.Object.prototype.write = function(stream) {
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

/** @override */
ds.Result.Object.prototype.string = function() {
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

/** @override */
ds.Result.Object.prototype.object = function() {
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

// ----------------------------------------------------------------------------------------------------------------- //

