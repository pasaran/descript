// ----------------------------------------------------------------------------------------------------------------- //
// ds.Options
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @typedef {(
        {
            dirname: (string|undefined),
            guard: (function()|undefined),
            select: (!Object|undefined),
            before: (function()|undefined),
            after: (function()|undefined),
            timeout: (number|undefined),
            key: (string|undefined),
            maxage: (number|undefined)
        } | undefined
    )}
*/
ds.Options;

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {*} block
    @param {ds.Options=} options
*/
ds.Block = function(block, options) {};

/**
    @param {ds.Options=} options
*/
ds.Block.prototype.setOptions = function(options) {
    var _options = this.options = options || {};

    this.priority = 0;

    this.dirname = _options.dirname || ds.config['rootdir'];

    var guard = _options.guard;
    if (guard) {
        if (typeof guard === 'string') { // Нужно скомпилировать в функцию. Т.е. можно писать так:
                                         // guard: 'state.foo && !request.boo'
            this.guard = new Function('context', 'var state = context.state, request = context.request; return ' + guard + ';');
        } else {
            this.guard = guard;
        }
    }

    var select = _options.select;
    if (select) {
        for (var key in select) {
            select[key] = ds.util.compileJPath(select[key]);
        }
        this.select = select;
    }

    this.before = _options.before;
    this.after = _options.after;

    this.timeout = _options.timeout;

    if (_options.key && _options.maxage !== undefined) {
        this.key = _options.key;
        this.maxage = ds.util.duration( _options.maxage );
    }
};

// ----------------------------------------------------------------------------------------------------------------- //

ds.Block._id = 0;

/** @type {!Object.<string, ds.Block>} */
ds.Block._blocks = {};

/**
    @return {string}
*/
ds.Block.prototype.valueOf = function() {
    var id = this._id;
    if (!id) {
        id = this._id = '@block' + ds.Block._id++ + '@';
        ds.Block._blocks[id] = this;
    }

    return id;
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {ds.Context} context
    @param {!Object} params
    @return {no.Promise}
*/
ds.Block.prototype.run = function(context, params) {
    var promise;
    var isCached;

    var before = this.before; // FIXME: На закэшированные блоки before не окажет никакого влияния.
    if (before) {
        before(context);
    }

    var guard = this.guard;
    if (guard && !guard(context)) {
        promise = new no.Promise();
        promise.resolve( new ds.Result.Value(null) ); // FIXME: Или же возвращать ошибку.

    } else {
        var key = this.key;
        if (key) {
            var cached = ds.Result._cache[key];
            if ( cached && (cached.timestamp + this.maxage > context.now) ) {
                promise = cached.promise;
                isCached = true;
            }
        }

        if (!promise) {
            promise = new no.Promise();

            if (key) {
                ds.Result._cache[key] = {
                    timestamp: context.now,
                    promise: promise
                };

                promise.then(function(result) {
                    if (result instanceof ds.Result.Error) {
                        delete ds.Result._cache[key];
                    }
                });
            }
        }

        var timeout;
        if (this.timeout) {
            promise.then(function() {
                if (timeout) {
                    clearTimeout(timeout);
                }
            });

            timeout = setTimeout(function() {
                promise.resolve( new ds.Result.Error({
                    id: 'TIMEOUT',
                    message: 'Timeout' // FIXME: Вменяемый текст.
                }) );
            }, this.timeout);
        }

        var select = this.select;
        if (select) {
            promise.then(function(result) {
                var state = context['state'];

                result = result.object();
                for (var key in select) {
                    state[key] = select[key](result);
                }
            });
        }

        var after = this.after;
        if (after) {
            promise.then(function(result) {
                after(context, result);
            });
        }

        // params = (this.params) ? this.params(context, params) : params; // FIXME: Пока вроде не нужно.

        if (!isCached) {
            this._run(promise, context, params);
        }
    }

    return promise;
};

/**
    @param {no.Promise} promise
    @param {ds.Context} context
    @param {!Object} params
*/
ds.Block.prototype._run = function(promise, context, params) {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @return {Array.<ds.Block>}
*/
ds.Block.prototype.subblocks = function() {
    return [ this ];
};

/**
    @param {{ results: Array.<ds.Result>, index: number }} result
    @return {ds.Result}
*/
ds.Block.prototype.getResult = function(result) {
    return result.results[ result.index++ ];
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {number} priority
*/
ds.Block.prototype.setPriority = function(priority) {
    this.priority = priority;
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block.Array
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {Array} array
    @param {ds.Options=} options
    @extends {ds.Block}
*/
ds.Block.Array = function(array, options) {
    this.setOptions(options);

    var blocks = this.blocks = [];

    for (var i = 0, l = array.length; i < l; i++) {
        blocks.push( ds.Block.compile( array[i], options ) );
    }
};

node.util.inherits( ds.Block.Array, ds.Block );

/** @override */
ds.Block.Array.prototype.subblocks = function() {
    var subblocks = [];

    var blocks = this.blocks;
    for (var i = 0, l = blocks.length; i < l; i++) {
        subblocks = subblocks.concat( blocks[i].subblocks() );
    }

    return subblocks;
};

/** @override */
ds.Block.Array.prototype.getResult = function(result) {
    var blocks = this.blocks;
    var r = [];

    for (var i = 0, l = blocks.length; i < l; i++) {
        r.push( blocks[i].getResult(result) );
    }

    return new ds.Result.Array(r);
};

/** @override */
ds.Block.Array.prototype.setPriority = function(priority) {
    var blocks = this.blocks;

    for (var i = 0, l = blocks.length; i < l; i++) {
        blocks[i].priority += priority;
    }
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block.Object
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {Object} object
    @param {ds.Options=} options
    @extends {ds.Block}
*/
ds.Block.Object = function(object, options) {
    this.setOptions(options);

    var blocks = this.blocks = [];
    var keys = this.keys = [];

    for (var key in object) {
        blocks.push( ds.Block.compile( object[key], options ) );
        keys.push(key);
    }
};

node.util.inherits( ds.Block.Object, ds.Block );

/** @override */
ds.Block.Object.prototype.subblocks = ds.Block.Array.prototype.subblocks;

/** @override */
ds.Block.Object.prototype.setPriority = ds.Block.Array.prototype.setPriority;

/** @override */
ds.Block.Object.prototype.getResult = function(result) {
    var blocks = this.blocks;
    var keys = this.keys;

    var r = {};

    for (var i = 0, l = blocks.length; i < l; i++) {
        r[ keys[i] ] = blocks[i].getResult(result);
    }

    return new ds.Result.Object(r);
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block.File
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {string} filename
    @param {ds.Options=} options
    @extends {ds.Block}
*/
ds.Block.File = function(filename, options) {
    this.setOptions(options);

    this.filename = ds.util.compileString(filename);
};

node.util.inherits( ds.Block.File, ds.Block );

/** @override */
ds.Block.File.prototype._run = function(promise, context, params) {
    var filename = ds.util.resolveFilename( this.dirname, this.filename(context, params) );

    de.file.get(filename)
        .then(function(result) {
            promise.resolve( new ds.Result.Raw([ result ], true) ); // FIXME: Учесть options.dataType.
        })
        .else_(function(error) {
            promise.resolve( new ds.Result.Error(error) );
        });
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block.Function
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {function(ds.Context, !Object)} func
    @param {ds.Options=} options
    @extends {ds.Block}
*/
ds.Block.Function = function(func, options) {
    this.func = func;
    this.setOptions(options);
};

node.util.inherits( ds.Block.Function, ds.Block );

/** @override */
ds.Block.Function.prototype._run = function(promise, context, params) {
    var result = this.func(context, params);

    var block = new ds.Block.Root(result); // FIXME: Правильные options.
    block.run(context, params).then(function(result) {
        promise.resolve(result);
    });
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block.Call
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {string} call
    @param {ds.Options=} options
    @extends {ds.Block}
*/
ds.Block.Call = function(call, options) {
    this.setOptions(options);

    var r = call.match(/^(?:(.*?):)?(.*)\(\)$/);

    var module = r[1] || ds.config.defaultModule;
    var method = this.method = r[2];

    module = ds.modules[module];

    call = module[method];
    this.call = (typeof call === 'function') ? call : module;
};

node.util.inherits(ds.Block.Call, ds.Block);

/** @override */
ds.Block.Call.prototype._run = function(promise, context, params) {
    this.call(promise, context, params, this.method);
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block.Include
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {string} filename
    @param {ds.Options=} options
    @extends {ds.Block}
*/
ds.Block.Include = function(filename, options) {
    this.setOptions(options);

    this.filename = ds.util.compileString(filename);
};

node.util.inherits(ds.Block.Include, ds.Block);

/**
    @type {!Object.<string, ds.Block.Root>}
*/
ds.Block.Include._cache = {};

/** @override */
ds.Block.Include.prototype._run = function(promise, context, params) {
    var filename = ds.util.resolveFilename( this.dirname, this.filename(context, params) );

    var block = ds.Block.Include._cache[ filename ];
    if (block) {
        block.run(context, params).then(function(result) {
            promise.resolve(result);
        });
        return;
    }

    var that = this;

    de.file.get(filename)
        .then(function(result) {
            try {
                var include = node.vm.runInNewContext( '(' + result + ')', ds.sandbox, filename);

                var dirname = node.path.dirname(filename);

                var options = /** @type {ds.Options} */ ( ds.util.extend( {}, that.options, { dirname: dirname } ) ); // NOTE: Внешние скобки нужны, чтобы gcc применил type cast.
                var block = ds.Block.Include._cache[ filename ] = new ds.Block.Root(include, options);

                block.run(context, params).then(function(result) {
                    promise.resolve(result);
                });
            } catch (e) {
                promise.resolve( new ds.Result.Error({
                    id: 'FILE_EVAL_ERROR',
                    message: e.message,
                    e: e
                }) );
            }
        })
        .else_(function(error) {
            promise.resolve( new ds.Result.Error(error) );
        });
};

no.events.bind('file-changed', function(e, filename) {
    /** @type {string} */ filename;

    delete ds.Block.Include._cache[ filename ];
});

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block.Http
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {string} url
    @param {ds.Options=} options
    @extends {ds.Block}
*/
ds.Block.Http = function(url, options) {
    this.setOptions(options);

    if (/(\?|&)$/.test(url)) {
        this.extend = true;
        url = url.substr(0, url.length - 1);
    }

    this.url = ds.util.compileString(url);
};

node.util.inherits(ds.Block.Http, ds.Block);

/** @override */
ds.Block.Http.prototype._run = function(promise, context, params) {
    var options = de.http.url2options(
        this.url(context, params),
        (this.extend) ? params : null
    );

    de.http.get(options)
        .then(function(result) {
            promise.resolve( new ds.Result.Raw(result, true) ); // FIXME: Учесть options.dataType.
        })
        .else_(function(error) {
            promise.resolve( new ds.Result.Error(error) );
        });

};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block.Value
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {number|boolean|string|Object} value
    @param {ds.Options=} options
    @extends {ds.Block}
*/
ds.Block.Value = function(value, options) {
    this.setOptions(options);
    this.value = value;
};

node.util.inherits(ds.Block.Value, ds.Block);

/** @override */
ds.Block.Value.prototype._run = function(promise, context, params) {
    promise.resolve( new ds.Result.Value(this.value) );
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Block.Root
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {(number|boolean|string|Object|Array|function(ds.Context))} root
    @param {ds.Options=} options
    @extends {ds.Block}
*/
ds.Block.Root = function(root, options) {
    this.setOptions(options);

    this.root = ds.Block.compile(root, options);

    var subblocks = this.subblocks = this.root.subblocks();

    var sorted = [];
    for (var i = 0, l = subblocks.length; i < l; i++) {
        sorted.push({
            index: i,
            block: subblocks[i]
        });
    }
    this.subblocks = sorted.sort(function(a, b) { return b.block.priority - a.block.priority; });
};

node.util.inherits( ds.Block.Root, ds.Block );

/** @override */
ds.Block.Root.prototype._run = function(promise, context, params) {
    var that = this;

    var results = [];

    var subblocks = this.subblocks;

    var i = 0;
    var l = subblocks.length;
    var block = subblocks[0];

    (function run() {
        if (i < l) {
            var promises = [];

            do {
                (function(block) {
                    var promise = block.block.run(context, params).then(function(r) {
                        results[ block.index ] = r;
                    });
                    promises.push(promise);
                })(block);

                var next = subblocks[++i];
                var endgroup = !next || block.block.priority !== next.block.priority;

                block = next;
            } while (!endgroup);

            no.Promise.wait(promises).then(run);

        } else {
            promise.resolve(that.root.getResult({
                results: results,
                index: 0
            }));
        }
    })();
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {(number|boolean|string|Object|Array|function(ds.Context))} block
    @param {ds.Options=} options
*/
ds.Block.compile = function(block, options) {

    // options = options || {};

    var compiled;
    var priority;

    switch (typeof block) {

        case 'string':

            var r;

            if (( r = /^http:\/\//.test(block) )) { // Строка начинается с 'http://' -- это http-блок.
                                                    // FIXME: Поддержка https, post, get и т.д.
                compiled = new ds.Block.Http(block, options);

            } else if (( r = block.match(/^(.*\(\))(\d+)?$/) )) { // Строка оканчивается на '()' -- это call-блок.
                compiled = new ds.Block.Call(r[1], options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.jsx)(\d+)?$/) )) { // Строка оканчивается на '.jsx' -- это include-блок.
                compiled = new ds.Block.Include(r[1], options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.(?:json|txt|xml))(\d+)?$/) )) { // Строка оканчивается на '.json' -- это file-блок.
                compiled = new ds.Block.File(r[1], options);
                priority = r[2];

            //  В предыдущих трех случаях в конце строки может быть число, означающее приоритет.
            //  Например:
            //      {
            //          common: 'common.jsx' + 25,
            //          ...
            //      }
            //
            //  В случае http-блока, приоритет нужно задавать так (потому, что число на конце может быть частью урла):
            //      {
            //          common: http('http://foo.com/bar') +25,
            //          ...
            //      }
            //
            //  Работает это за счет того, что у ds.Block переопределен метод valueOf,
            //  который возвращает уникальную строку вида '@block25@'.

            } else if (( r = block.match(/^(@block\d+@)(\d+)$/) ) || ( r = block.match(/^(\d+)(@block\d+@)$/) )) { // Строка вида '@block25@45' или '45@block25@',
                                                                                                                   // где 25 это порядковый номер блока, а 45 -- приоритет.
                var id = r[1];

                compiled = ds.Block._blocks[id];
                priority = r[2];

                delete ds.Block._blocks[id];

            }

            break;

        case 'object':

            if (block instanceof Array) {
                compiled = new ds.Block.Array(block, options);

            } else if (block && !(block instanceof ds.Block)) {
                compiled = new ds.Block.Object(/** @type {!Object} */ block, options);

            } else {
                compiled = block;

            }

            break;

        case 'function':

            /** @type {function(ds.Context)} */ block;

            compiled = new ds.Block.Function(block, options);

            break;

    }

    if (!compiled) {
        compiled = new ds.Block.Value(block, options);
    }

    if (priority) {
        compiled.setPriority( +priority );
    }

    return compiled;

};

// ----------------------------------------------------------------------------------------------------------------- //

ds.sandbox = {};

// ----------------------------------------------------------------------------------------------------------------- //

ds.sandbox['http'] = function(url, options) {
    return new ds.Block.Http(url, options);
};

ds.sandbox['file'] = function(filename, options) {
    return new ds.Block.File(filename, options);
};

ds.sandbox['include'] = function(filename, options) {
    return new ds.Block.Include(filename, options);
};

ds.sandbox['call'] = function(call, options) {
    return new ds.Block.Call(call, options);
};

ds.sandbox['array'] = function(array, options) {
    return new ds.Block.Array(array, options);
};

ds.sandbox['object'] = function(object, options) {
    return new ds.Block.Object(object, options);
};

ds.sandbox['value'] = function(value, options) {
    return new ds.Block.Value(value, options);
};

ds.sandbox['func'] = function(func, options) {
    return new ds.Block.Function(func, options);
};

// ----------------------------------------------------------------------------------------------------------------- //

