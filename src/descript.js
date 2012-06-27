//  ---------------------------------------------------------------------------------------------------------------  //
//  Descript
//  ---------------------------------------------------------------------------------------------------------------  //

var Block = require('./block.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var Descript = function(config, modules) {
    this.config = config || {};
    this.modules = modules || {};

    this._initSandbox();
};

//  ---------------------------------------------------------------------------------------------------------------  //

Descript.prototype.start = function() {

};

//  ---------------------------------------------------------------------------------------------------------------  //

Descript.prototype._initSandbox = function() {
    var config = this.config;

    var sandbox = this.sandbox = {};
    var descript = this;

    sandbox.http = function(url, options) {
        return new Block.Http(url, descript, options);
    };

    sandbox.file = function(filename, options) {
        return new Block.File(filename, descript, options);
    };

    sandbox.include = function(filename, options) {
        return new Block.Include(filename, descript, options);
    };

    sandbox.call = function(call, options) {
        return new Block.Call(call, descript, options);
    };

    sandbox.array = function(array, options) {
        return new Block.Array(array, descript, options);
    };

    sandbox.object = function(object, options) {
        return new Block.Object(object, descript, options);
    };

    sandbox.value = function(value, options) {
        return new Block.Value(value, descript, options);
    };

    sandbox.func = function(func, options) {
        return new Block.Function(func, descript, options);
    };

};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = Descript;

//  ---------------------------------------------------------------------------------------------------------------  //

