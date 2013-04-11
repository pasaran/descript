var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

de.sandbox = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.sandbox.block = de.Block.compile;

de.sandbox.http = function(url, options) {
    return new de.Block.Http(url, options);
};

de.sandbox.file = function(filename, options) {
    return new de.Block.File(filename, options);
};

de.sandbox.include = function(filename, options) {
    return new de.Block.Include(filename, options);
};

de.sandbox.call = function(call, options) {
    return new de.Block.Call(call, options);
};

de.sandbox.array = function(array, options) {
    return new de.Block.Array(array, options);
};

de.sandbox.object = function(object, options) {
    return new de.Block.Object(object, options);
};

de.sandbox.value = function(value, options) {
    return new de.Block.Value(value, options);
};

de.sandbox.func = function(func, options) {
    return new de.Block.Function(func, options);
};

de.sandbox.expr = function(expr, options) {
    return new de.Block.Expr(expr, options);
};

//  ---------------------------------------------------------------------------------------------------------------  //

