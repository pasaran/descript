// ----------------------------------------------------------------------------------------------------------------- //
// Result
// ----------------------------------------------------------------------------------------------------------------- //

var Result = function(result) {
    this.result = result;
};

Result.prototype.string = function() {
    return this.result;
};

Result.prototype.object = function() {
    var o = this._object;
    if (!o) {
        o = this._object = JSON.parse(this.result);
    }

    return o;
};

// ----------------------------------------------------------------------------------------------------------------- //
// Result.Value
// ----------------------------------------------------------------------------------------------------------------- //

Result.Value = function(result) {
    this.result = result;
};

Result.Value.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        s = this._string = JSON.stringify(this.result);
    }

    return s;
};

Result.Value.prototype.object = function() {
    return this.result;
};

// ----------------------------------------------------------------------------------------------------------------- //
// Result.Error
// ----------------------------------------------------------------------------------------------------------------- //

Result.Error = function(error) {
    this.result = {
        error: error || {}
    };
};

Result.Error.prototype.get = function(field) {
    return this.result.error[field];
};

Result.Error.prototype.string = Result.Value.prototype.string;
Result.Error.prototype.object = Result.Value.prototype.object;

// ----------------------------------------------------------------------------------------------------------------- //
// Result.Array
// ----------------------------------------------------------------------------------------------------------------- //

Result.Array = function(result) {
    this.result = result;
};

Result.Array.prototype.string = function() {
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

// ----------------------------------------------------------------------------------------------------------------- //
// Result.Object
// ----------------------------------------------------------------------------------------------------------------- //

Result.Object = function(result) {
    this.result = result;
};

Result.Object.prototype.string = function() {
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

// ----------------------------------------------------------------------------------------------------------------- //

module.exports = Result;

// ----------------------------------------------------------------------------------------------------------------- //

