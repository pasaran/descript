var Descript = function(config) {
    this.config = config;

    this._initSandbox();
};

//  ---------------------------------------------------------------------------------------------------------------  //

Descript.prototype.start = function() {

};

//  ---------------------------------------------------------------------------------------------------------------  //

Descript.prototype._initSandbox = function() {
    var config = this.config;

    var sandbox = this.sandbox = {};

    sandbox.http = function(url, options) {
        return new Block.Http(url, config, sandbox, options);
    };

    sandbox.file = function(filename, options) {
        return new Block.File(filename, config, sandbox, options);
    };

    sandbox.include = function(filename, options) {
        return new Block.Include(filename, config, sandbox, options);
    };

    sandbox.call = function(call, options) {
        return new Block.Call(call, config, sandbox, options);
    };

    sandbox.array = function(array, options) {
        return new Block.Array(array, config, sandbox, options);
    };

    sandbox.object = function(object, options) {
        return new Block.Object(object, config, sandbox, options);
    };

    sandbox.value = function(value, options) {
        return new Block.Value(value, config, sandbox, options);
    };

    sandbox.func = function(func, options) {
        return new Block.Function(func, config, sandbox, options);
    };

};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = Descript;

//  ---------------------------------------------------------------------------------------------------------------  //

