// ----------------------------------------------------------------------------------------------------------------- //
// de.Block
// ----------------------------------------------------------------------------------------------------------------- //

de.Block = function(block, options) {};

de.Block.prototype.setOptions = function(options) {
    this.options = options = options || {};

    this.priority = 0;

    this.dirname = options.dirname || de.config.rootdir;

    var guard = options.guard;
    if (guard) {
        if (typeof guard === 'string') { // Нужно скомпилировать в функцию. Т.е. можно писать так:
                                         // guard: 'state.foo && !request.boo'
            this.guard = new Function('context', 'var state = context.state, request = context.request; return ' + guard + ';');
        } else {
            this.guard = guard;
        }
    }

    var select = options.select;
    if (select) {
        for (var key in select) {
            select[key] = de.util.compileJPath(select[key]);
        }
        this.select = select;
    }

    this.before = options.before;
    this.after = options.after;

    this.timeout = options.timeout;
};

// ----------------------------------------------------------------------------------------------------------------- //

de.Block._id = 0;
de.Block._blocks = {};

de.Block.prototype.valueOf = function() {
    var id = this._id;
    if (!id) {
        id = this._id = '@block' + de.Block._id++ + '@';
        de.Block._blocks[id] = this;
    }

    return id;
};

// ----------------------------------------------------------------------------------------------------------------- //

de.Block.prototype.run = function(context) {
    var promise = new no.Promise();

    var before = this.before;
    if (before) {
        before(context);
    }

    var guard = this.guard;
    if (guard && !guard(context)) {
        promise.resolve( new de.Result.Value(null) ); // FIXME: Или же возвращать ошибку.
    } else {
        var timeout;
        if (this.timeout) {
            promise.then(function() {
                if (timeout) {
                    clearTimeout(timeout);
                }
            });

            timeout = setTimeout(function() {
                promise.resolve( new de.Result.Error({
                    id: 'TIMEOUT',
                    message: 'Timeout' // FIXME: Вменяемый текст.
                }) );
            }, this.timeout);
        }

        var select = this.select;
        if (select) {
            promise.then(function(result) {
                var state = context.state;

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

        this._run(promise, context);
    }

    return promise;
};

// ----------------------------------------------------------------------------------------------------------------- //

de.Block.prototype.subblocks = function() {
    return [ this ];
};

de.Block.prototype.getResult = function(result) {
    return result.results[ result.index++ ];
};

// ----------------------------------------------------------------------------------------------------------------- //

de.Block.prototype.setPriority = function(priority) {
    this.priority = priority;
};

// ----------------------------------------------------------------------------------------------------------------- //

de.Block.prototype.getParams = function(context) {
    var params = this.options.params;

    return (params) ? params(context) : context.request.query;
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Array
// ----------------------------------------------------------------------------------------------------------------- //

de.Block.Array = function(array, options) {
    this.setOptions(options);

    var blocks = this.blocks = [];

    for (var i = 0, l = array.length; i < l; i++) {
        blocks.push( de.Block.compile( array[i], options ) );
    }
};

node.util.inherits( de.Block.Array, de.Block );

de.Block.Array.prototype.subblocks = function() {
    var subblocks = [];

    var blocks = this.blocks;
    for (var i = 0, l = blocks.length; i < l; i++) {
        subblocks = subblocks.concat( blocks[i].subblocks() );
    }

    return subblocks;
};

de.Block.Array.prototype.getResult = function(result) {
    var blocks = this.blocks;
    var r = [];

    for (var i = 0, l = blocks.length; i < l; i++) {
        r.push( blocks[i].getResult(result) );
    }

    return new de.Result.Array(r);
};

de.Block.Array.prototype.setPriority = function(priority) {
    var blocks = this.blocks;

    for (var i = 0, l = blocks.length; i < l; i++) {
        blocks[i].priority += priority;
    }
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Object
// ----------------------------------------------------------------------------------------------------------------- //

de.Block.Object = function(object, options) {
    this.setOptions(options);

    var blocks = this.blocks = [];
    var keys = this.keys = [];

    for (var key in object) {
        blocks.push( de.Block.compile( object[key], options ) );
        keys.push(key);
    }
};

node.util.inherits( de.Block.Object, de.Block );

de.Block.Object.prototype.subblocks = de.Block.Array.prototype.subblocks;
de.Block.Object.prototype.setPriority = de.Block.Array.prototype.setPriority;

de.Block.Object.prototype.getResult = function(result) {
    var blocks = this.blocks;
    var keys = this.keys;

    var r = {};

    for (var i = 0, l = blocks.length; i < l; i++) {
        r[ keys[i] ] = blocks[i].getResult(result);
    }

    return new de.Result.Object(r);
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.File
// ----------------------------------------------------------------------------------------------------------------- //

de.Block.File = function(filename, options) {
    this.setOptions(options);

    this.filename = de.util.compileString(filename);
};

node.util.inherits( de.Block.File, de.Block );

de.Block.File.prototype._run = function(promise, context) {
    var filename = de.util.resolveFilename( this.dirname, this.filename(context) );

    de.file.get(filename)
        .then(function(result) {
            promise.resolve( new de.Result.Raw(result) );
        })
        .else_(function(error) {
            promise.resolve( new de.Result.Error(error) );
        });
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Function
// ----------------------------------------------------------------------------------------------------------------- //

de.Block.Function = function(func, options) {
    this.func = func;
    this.setOptions(options);
};

node.util.inherits( de.Block.Function, de.Block );

de.Block.Function.prototype._run = function(promise, context) {
    var result = this.func(context);

    var block = new de.Block.Root(result); // FIXME: Правильные options.
    block.run(context).then(function(result) {
        promise.resolve(result);
    });
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Call
// ----------------------------------------------------------------------------------------------------------------- //

de.Block.Call = function(call, options) {
    this.setOptions(options);

    var r = call.match(/^(?:(.*?):)?(.*)\(\)$/);

    var module = r[1] || de.config.defaultModule;
    var method = this.method = r[2];

    module = de.modules[module];

    var call = module[method];
    this.call = (typeof call === 'function') ? call : module;
};

node.util.inherits(de.Block.Call, de.Block);

de.Block.Call.prototype._run = function(promise, context) {
    this.call(promise, context);
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Include
// ----------------------------------------------------------------------------------------------------------------- //

de.Block.Include = function(filename, options) {
    this.setOptions(options);

    this.filename = de.util.compileString(filename);
};

node.util.inherits(de.Block.Include, de.Block);

de.Block.Include._cache = {};

de.Block.Include.prototype._run = function(promise, context) {
    var filename = de.util.resolveFilename( this.dirname, this.filename(context) );

    var block = de.Block.Include._cache[filename];
    if (block) {
        block.run(context).then(function(result) {
            promise.resolve(result);
        });
        return;
    }

    var that = this;

    de.file.get(filename)
        .then(function(result) {
            try {
                var content = result.join('');
                var include = node.vm.runInNewContext( '(' + content + ')', de.sandbox, filename);

                var dirname = node.path.dirname(filename);

                var options = de.util.extends( {}, that.options, { dirname: dirname } );
                var block = de.Block.Include._cache[filename] = new de.Block.Root(include, options);

                block.run(context).then(function(result) {
                    promise.resolve(result);
                });
            } catch (e) {
                promise.resolve( new de.Result.Error({
                    id: 'FILE_EVAL_ERROR',
                    message: e.message,
                    e: e
                }) );
            }
        })
        .else_(function(error) {
            promise.resolve( new de.Result.Error(error) );
        });

};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Http
// ----------------------------------------------------------------------------------------------------------------- //

de.Block.Http = function(url, options) {
    this.setOptions(options);

    if (/(\?|&)$/.test(url)) {
        this.extend = true;
        url = url.substr(0, url.length - 1);
    }

    this.url = de.util.compileString(url);
};

node.util.inherits(de.Block.Http, de.Block);

de.Block.Http.prototype._run = function(promise, context) {
    var options = de.http.url2options(
        this.url(context),
        (this.extend) ? this.getParams(context) : null
    );

    de.http.get(options)
        .then(function(result) {
            promise.resolve( new de.Result.Raw(result) ); // FIXME: Учесть options.dataType.
        })
        .else_(function(error) {
            promise.resolve( new de.Result.Error(error) );
        });

};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Value
// ----------------------------------------------------------------------------------------------------------------- //

de.Block.Value = function(value, options) {
    this.setOptions(options);
    this.value = value;
};

node.util.inherits(de.Block.Value, de.Block);

de.Block.Value.prototype._run = function(promise, params) {
    promise.resolve( new de.Result.Value(this.value) );
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Root
// ----------------------------------------------------------------------------------------------------------------- //

de.Block.Root = function(root, options) {
    this.setOptions(options);

    this.root = de.Block.compile(root, options);

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

node.util.inherits( de.Block.Root, de.Block );

de.Block.Root.prototype._run = function(promise, context) {
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
                    var promise = block.block.run(context).then(function(r) {
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

de.Block.compile = function(block, options) {

    options = options || {};

    var compiled;
    var priority;

    switch (typeof block) {

        case 'string':

            var r;

            if (( r = /^http:\/\//.test(block) )) { // Строка начинается с 'http://' -- это http-блок.
                                                    // FIXME: Поддержка https, post, get и т.д.
                compiled = new de.Block.Http(block, options);

            } else if (( r = block.match(/^(.*\(\))(\d+)?$/) )) { // Строка оканчивается на '()' -- это call-блок.
                compiled = new de.Block.Call(r[1], options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.jsx)(\d+)?$/) )) { // Строка оканчивается на '.jsx' -- это include-блок.
                compiled = new de.Block.Include(r[1], options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.(?:json|txt|xml))(\d+)?$/) )) { // Строка оканчивается на '.json' -- это file-блок.
                compiled = new de.Block.File(r[1], options);
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
            //  Работает это за счет того, что у de.Block переопределен метод valueOf,
            //  который возвращает уникальную строку вида '@block25@'.

            } else if (( r = block.match(/^(@block\d+@)(\d+)$/) ) || ( r = block.match(/^(\d+)(@block\d+@)$/) )) { // Строка вида '@block25@45' или '45@block25@',
                                                                                                                   // где 25 это порядковый номер блока, а 45 -- приоритет.
                var id = r[1];

                compiled = de.Block._blocks[id];
                priority = r[2];

                delete de.Block._blocks[id];

            }

            break;

        case 'object':

            if (block instanceof Array) {
                compiled = new de.Block.Array(block, options);

            } else if (block && !(block instanceof de.Block)) {
                compiled = new de.Block.Object(block, options);

            } else {
                compiled = block;

            }

            break;

        case 'function':

            compiled = new de.Block.Function(block, options);

            break;

    }

    if (!compiled) {
        compiled = new de.Block.Value(block, options);
    }

    if (priority) {
        compiled.setPriority( +priority );
    }

    return compiled;

};

// ----------------------------------------------------------------------------------------------------------------- //

de.sandbox = {};

// ----------------------------------------------------------------------------------------------------------------- //

de.sandbox['http'] = function(url, options) {
    return new de.Block.Http(url, options);
};

de.sandbox['file'] = function(filename, options) {
    return new de.Block.File(filename, options);
};

de.sandbox['include'] = function(filename, options) {
    return new de.Block.Include(filename, options);
};

de.sandbox['call'] = function(call, options) {
    return new de.Block.Call(call, options);
};

de.sandbox['array'] = function(array, options) {
    return new de.Block.Array(array, options);
};

de.sandbox['object'] = function(object, options) {
    return new de.Block.Object(object, options);
};

de.sandbox['value'] = function(value, options) {
    return new de.Block.Value(value, options);
};

de.sandbox['func'] = function(func, options) {
    return new de.Block.Function(func, options);
};

// ----------------------------------------------------------------------------------------------------------------- //

