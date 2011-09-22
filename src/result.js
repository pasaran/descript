// ----------------------------------------------------------------------------------------------------------------- //
// de.Result
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {*} result
*/
de.Result = function(result) {};

/**
    @return {string}
*/
de.Result.prototype.string = function() {};

/**
    @return {Object}
*/
de.Result.prototype.object = function() {};

/**
    @param {Stream} stream
*/
de.Result.prototype.write = function(stream) {};

/**
    @return {string}
*/
de.Result.prototype.formatted = function() {
    return JSON.stringify( this.object(), null, '    ' );
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @type {Object.<string, de.Result>}
*/
de.Result._cache = {};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Raw
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {de.Result}
    @param {Array.<Buffer>} result
    @param {boolean|undefined} isJSON
*/
de.Result.Raw = function(result, isJSON) {
    this.result = result;
    this.isJSON = isJSON;
};

node.util.inherits( de.Result.Raw, de.Result );

/** @override */
de.Result.Raw.prototype.write = function(stream) {
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        stream.write( result[i] );
    }
};

/** @override */
de.Result.Raw.prototype.string = function() {
    var s = this._string;

    if (!s) {
        s = this._string = this.result.join('');
    }

    return s;
};

/** @override */
de.Result.Raw.prototype.object = function() {
    var o = this._object;

    if (!o) {
        o = this._object = (this.isJSON) ? JSON.parse( this.string() ) : this.string();
    }

    return o;
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Value
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {*} result
*/
de.Result.Value = function(result) {
    this.result = result;
};

node.util.inherits( de.Result.Value, de.Result );

/** @override */
de.Result.Value.prototype.write = function(stream) {
    stream.write( this.string() );
};

/** @override */
de.Result.Value.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        s = this._string = JSON.stringify( this.result );
    }

    return s;
};

/** @override */
de.Result.Value.prototype.object = function() {
    return this.result;
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Error
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {de.Result.Value}
    @param {!Object} error
*/
de.Result.Error = function(error) {
    this.result = {
        error: error
    };
};

node.util.inherits( de.Result.Error, de.Result.Value );

/**
    @param {string} field
    @return {*}
*/
de.Result.Error.prototype.get = function(field) {
    return this.result.error[field];
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Array
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {de.Result}
    @param {Array} result
*/
de.Result.Array = function(result) {
    this.result = result;
};

node.util.inherits( de.Result.Array, de.Result );

/** @override */
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

/** @override */
de.Result.Array.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        var result = this.result;

        var s = '[';
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

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Object
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {de.Result}
    @param {!Object} result
*/
de.Result.Object = function(result) {
    this.result = result;
};

node.util.inherits( de.Result.Object, de.Result );

/** @override */
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

/** @override */
de.Result.Object.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        var result = this.result;

        var s = '{';
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

// ----------------------------------------------------------------------------------------------------------------- //

