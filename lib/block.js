//  ---------------------------------------------------------------------------------------------------------------  //
//  Block
//  ---------------------------------------------------------------------------------------------------------------  //

var util_ = require('util');
var vm_ = require('vm');
var path_ = require('path');

//  ---------------------------------------------------------------------------------------------------------------  //

var de = require('./de.js');
var no = require('noscript');

var Result = require('./result.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var Block = function(block, descript, options) {};

//  ---------------------------------------------------------------------------------------------------------------  //

Block.prototype._init = function(descript, options) {
    this.descript = descript;

    var _options = this.options = options || {};

    this.priority = 0;

    this.dirname = _options.dirname || descript.config.rootdir;

    var guard = _options.guard;
    if (guard) {
        if (typeof guard === 'string') {
            //  Нужно скомпилировать в функцию. Т.е. можно писать так:
            //      guard: 'state.foo && !request.boo'
            this.guard = new Function('context', 'var state = context.state, request = context.request; return ' + guard + ';');
        } else {
            this.guard = guard;
        }
    }

    var select = _options.select;
    if (select) {
        for (var key in select) {
            select[key] = de.compileJPath(select[key]);
        }
        this.select = select;
    }

    this.before = _options.before;
    this.after = _options.after;

    this.timeout = _options.timeout;

    if (_options.key && _options.maxage !== undefined) {
        this.key = _options.key;
        this.maxage = de.duration( _options.maxage );
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

var _id = 0;
var _blocks = {};

Block.prototype.valueOf = function() {
    var id = this._id;
    if (!id) {
        id = this._id = '@block' + _id++ + '@';
        _blocks[id] = this;
    }

    return id;
};

//  ---------------------------------------------------------------------------------------------------------------  //

Block.prototype.run = function(context, params) {
    var promise;
    var isCached;

    //  FIXME: На закэшированные блоки before не окажет никакого влияния.
    var before = this.before;
    if (before) {
        before(context);
    }

    var guard = this.guard;
    if (guard && !guard(context)) {
        promise = new no.Promise();
        promise.resolve( new Result.Value(null) );

    } else {
        var key = this.key;
        if (key) {
            var cached = Result._cache[key];
            if ( cached && (cached.timestamp + this.maxage > context.now) ) {
                promise = cached.promise;
                isCached = true;
            }
        }

        if (!promise) {
            promise = new no.Promise();

            if (key) {
                Result._cache[key] = {
                    timestamp: context.now,
                    promise: promise
                };

                promise.then(function(result) {
                    if (result instanceof Result.Error) {
                        delete Result._cache[key];
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
                promise.resolve( new Result.Error({
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

Block.prototype._run = function(promise, context, params) {};

//  ---------------------------------------------------------------------------------------------------------------  //

Block.prototype.subblocks = function() {
    return [ this ];
};

Block.prototype.getResult = function(result) {
    return result.results[ result.index++ ];
};

//  ---------------------------------------------------------------------------------------------------------------  //

Block.prototype.setPriority = function(priority) {
    this.priority = priority;
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Block.Array
//  ---------------------------------------------------------------------------------------------------------------  //

Block.Array = function(array, descript, options) {
    this._init(descript, options);

    var blocks = this.blocks = [];

    for (var i = 0, l = array.length; i < l; i++) {
        blocks.push( Block.compile( array[i], options ) );
    }
};

util_.inherits( Block.Array, Block );

Block.Array.prototype.subblocks = function() {
    var subblocks = [];

    var blocks = this.blocks;
    for (var i = 0, l = blocks.length; i < l; i++) {
        subblocks = subblocks.concat( blocks[i].subblocks() );
    }

    return subblocks;
};

Block.Array.prototype.getResult = function(result) {
    var blocks = this.blocks;
    var r = [];

    for (var i = 0, l = blocks.length; i < l; i++) {
        r.push( blocks[i].getResult(result) );
    }

    return new Result.Array(r);
};

Block.Array.prototype.setPriority = function(priority) {
    var blocks = this.blocks;

    for (var i = 0, l = blocks.length; i < l; i++) {
        blocks[i].priority += priority;
    }
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Block.Object
//  ---------------------------------------------------------------------------------------------------------------  //

Block.Object = function(object, descript, options) {
    this._init(descript, options);

    var blocks = this.blocks = [];
    var keys = this.keys = [];

    for (var key in object) {
        blocks.push( Block.compile( object[key], options ) );
        keys.push(key);
    }
};

util_.inherits( Block.Object, Block );

Block.Object.prototype.subblocks = Block.Array.prototype.subblocks;

Block.Object.prototype.setPriority = Block.Array.prototype.setPriority;

Block.Object.prototype.getResult = function(result) {
    var blocks = this.blocks;
    var keys = this.keys;

    var r = {};

    for (var i = 0, l = blocks.length; i < l; i++) {
        r[ keys[i] ] = blocks[i].getResult(result);
    }

    return new Result.Object(r);
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Block.File
//  ---------------------------------------------------------------------------------------------------------------  //

Block.File = function(filename, descript, options) {
    this._init(descript, options);

    this.filename = de.compileString(filename);
};

util_.inherits( Block.File, Block );

Block.File.prototype._run = function(promise, context, params) {
    var filename = path_.join( this.dirname, this.filename(context, params) );

    de.file.get(filename)
        .then(function(result) {
            //  FIXME: Учесть options.dataType.
            promise.resolve( new Result.Raw([ result ], true) );
        })
        .else_(function(error) {
            promise.resolve( new Result.Error(error) );
        });
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Block.Function
//  ---------------------------------------------------------------------------------------------------------------  //

Block.Function = function(func, descript, options) {
    this._init(descript, options);

    this.func = func;
};

util_.inherits( Block.Function, Block );

Block.Function.prototype._run = function(promise, context, params) {
    var result = this.func(context, params);

    //  FIXME: Правильные options.
    var block = new Block.Root(result);
    block.run(context, params).then(function(result) {
        promise.resolve(result);
    });
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Block.Call
//  ---------------------------------------------------------------------------------------------------------------  //

Block.Call = function(call, descript, options) {
    this._init(descript, options);

    var r = call.match(/^(?:(.*?):)?(.*)\(\)$/);

    var module = r[1] || '';
    var method = this.method = r[2];

    module = descript.modules[module];

    call = module[method];
    this.call = (typeof call === 'function') ? call : module;
};

util_.inherits(Block.Call, Block);

Block.Call.prototype._run = function(promise, context, params) {
    this.call(promise, context, params, this.method);
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Block.Include
//  ---------------------------------------------------------------------------------------------------------------  //

Block.Include = function(filename, descript, options) {
    this._init(descript, options);

    this.filename = de.compileString(filename);
};

util_.inherits(Block.Include, Block);

//  ---------------------------------------------------------------------------------------------------------------  //

Block.Include._cache = {};

Block.Include.prototype._run = function(promise, context, params) {
    var filename = path_.join( this.dirname, this.filename(context, params) );

    var block = Block.Include._cache[ filename ];
    if (block) {
        block.run(context, params).then(function(result) {
            promise.resolve(result);
        });
        return;
    }

    var that = this;
    var descript = this.descript;

    de.file.get(filename)
        .then(function(result) {
            try {
                //  FIXME: Защита от модификации sandbox.
                var include = vm_.runInNewContext( '(' + result + ')', descript.sandbox, filename);

                var dirname = path_.dirname(filename);

                var options = de.extend( {}, that.options, { dirname: dirname } );
                var block = Block.Include._cache[ filename ] = new Block.Root(include, descript, options);

                block.run(context, params).then(function(result) {
                    promise.resolve(result);
                });
            } catch (e) {
                promise.resolve( new Result.Error({
                    id: 'FILE_EVAL_ERROR',
                    message: e.message,
                    e: e
                }) );
                throw e;
            }
        })
        .else_(function(error) {
            promise.resolve( new Result.Error(error) );
        });
};

no.events.on('file-changed', function(e, filename) {
    delete Block.Include._cache[ filename ];
});


//  ---------------------------------------------------------------------------------------------------------------  //
//  Block.Http
//  ---------------------------------------------------------------------------------------------------------------  //

Block.Http = function(url, descript, options) {
    this._init(descript, options);

    if (/(\?|&)$/.test(url)) {
        this.extend = true;
        url = url.substr(0, url.length - 1);
    }

    this.url = de.compileString(url);
};

util_.inherits(Block.Http, Block);

//  ---------------------------------------------------------------------------------------------------------------  //

Block.Http.prototype._run = function(promise, context, params) {
    var options = de.http.url2options(
        this.url(context, params),
        (this.extend) ? params : null
    );

    de.http.get(options)
        .then(function(result) {
            promise.resolve( new Result.Raw(result, true) ); // FIXME: Учесть options.dataType.
        })
        .else_(function(error) {
            promise.resolve( new Result.Error(error) );
        });

};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Block.Value
//  ---------------------------------------------------------------------------------------------------------------  //

Block.Value = function(value, descript, options) {
    this._init(descript, options);

    this.value = value;
};

util_.inherits(Block.Value, Block);

//  ---------------------------------------------------------------------------------------------------------------  //

Block.Value.prototype._run = function(promise, context, params) {
    promise.resolve( new Result.Value(this.value) );
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  Block.Root
//  ---------------------------------------------------------------------------------------------------------------  //

Block.Root = function(root, descript, options) {
    this._init(descript, options);

    this.root = Block.compile(root, descript, options);

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

util_.inherits( Block.Root, Block );

//  ---------------------------------------------------------------------------------------------------------------  //

Block.Root.prototype._run = function(promise, context, params) {
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


//  ---------------------------------------------------------------------------------------------------------------  //

Block.compile = function(block, descript, options) {

    // options = options || {};

    var compiled;
    var priority;

    switch (typeof block) {

        case 'string':

            var r;

            if (( r = /^http:\/\//.test(block) )) { // Строка начинается с 'http://' -- это http-блок.
                                                    // FIXME: Поддержка https, post, get и т.д.
                compiled = new Block.Http(block, descript, options);

            } else if (( r = block.match(/^(.*\(\))(\d+)?$/) )) { // Строка оканчивается на '()' -- это call-блок.
                compiled = new Block.Call(r[1], descript, options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.jsx)(\d+)?$/) )) { // Строка оканчивается на '.jsx' -- это include-блок.
                compiled = new Block.Include(r[1], descript, options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.(?:json|txt|xml))(\d+)?$/) )) { // Строка оканчивается на '.json' -- это file-блок.
                compiled = new Block.File(r[1], descript, options);
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
            //  Работает это за счет того, что у Block переопределен метод valueOf,
            //  который возвращает уникальную строку вида '@block25@'.

            } else if (( r = block.match(/^(@block\d+@)(\d+)$/) ) || ( r = block.match(/^(\d+)(@block\d+@)$/) )) { // Строка вида '@block25@45' или '45@block25@',
                                                                                                                   // где 25 это порядковый номер блока, а 45 -- приоритет.
                var id = r[1];

                compiled = _blocks[id];
                priority = r[2];

                delete _blocks[id];

            }

            break;

        case 'object':

            //  NOTE: Тут нельзя использовать (block instanceof Array) потому, что .jsx файлы эвалятся
            //  в другом контексте и там другой Array. Для справки -- util.isArray примерно в 10 раз медленнее, чем instanceof.
            if ( Array.isArray(block) ) {
                compiled = new Block.Array(block, descript, options);

            } else if ( block && !(block instanceof Block) ) {
                compiled = new Block.Object(block, descript, options);

            } else {
                compiled = block;

            }

            break;

        case 'function':

            compiled = new Block.Function(block, descript, options);

            break;

    }

    if (!compiled) {
        compiled = new Block.Value(block, descript, options);
    }

    if (priority) {
        compiled.setPriority( +priority );
    }

    return compiled;

};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = Block;

//  ---------------------------------------------------------------------------------------------------------------  //

