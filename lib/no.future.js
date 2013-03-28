no.Future = function() {};

no.Future.prototype.run = function(params, context) {
    var promise = new no.Promise();

    if (this.before) {
        var r = this.before(params, context);

        if (r !== undefined) {
            return promise.resolve(r);
        }
    }

    var that = this;

    this._run(params, context)
        .done(function(result) {
            if (that.after) {
                var r = that.after(params, context, result);

                if (r !== undefined) {
                    return promise.resolve(r);
                }
            }

            promise.resolve(result);
        });

    return promise;
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.Future.Function = function(future) {
    this.future = future;
};

no.inherit(no.Future.Function, no.Future);

no.Future.Function.prototype.run = function(params, context) {
    return this.future(params, context);
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.Future.Array = function(futures) {
    this.futures = futures;
};

no.inherit(no.Future.Array, no.Future);

//  ---------------------------------------------------------------------------------------------------------------  //

no.Future.Object = function(futures) {
    this.futures = futures;
};

no.inherit(no.Future.Object, no.Future);

//  ---------------------------------------------------------------------------------------------------------------  //

no.future = function(future, priority) {
    switch (typeof future) {
        case 'function':
            return new no.Future(future, priority);

        case 'object':
            if (Array.isArray(future)) {
                return new no.Future.Array(future, priority);
            } else {
                return new no.Future.Object(future, priority);
            }
    }
};

//  TODO: Или no.Future.prototype.withParams()
//
no.Future.prototype.setParams = function(params) {
    return new no.Future.Curry(this, params);
};

no.Future.Curry = function(future, params) {
    this.future = future;
    this.params = params;
};

no.Future.Curry.prototype.run = function(params, context) {
    return this.future.run(this.params, context);
};

de.Block = function() {

};

no.extend(de.Block.prototype, no.Future);


