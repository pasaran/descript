// ----------------------------------------------------------------------------------------------------------------- //

var $fs = require('fs');
var $path = require('path');
var $url = require('url');
var $util = require('util');
var $vm = require('vm');

// ----------------------------------------------------------------------------------------------------------------- //

var config = global.config || {};
var modules = global.modules || {};

// ----------------------------------------------------------------------------------------------------------------- //

var Promise = require('../deps/noscript/promise.js');

var Result = require('./result.js');
var util = require('./util.js');

// ----------------------------------------------------------------------------------------------------------------- //
// Block
// ----------------------------------------------------------------------------------------------------------------- //

var Block = function(block, options) {};

Block.prototype.setOptions = function(options) {
    this.options = options = options || {};

    this.priority = 0;

    this.dirname = options.dirname || config.rootdir;

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
            select[key] = util.compileJPath(select[key]);
        }
        this.select = select;
    }

    this.before = options.before;
    this.after = options.after;

    this.timeout = options.timeout;
};

// ----------------------------------------------------------------------------------------------------------------- //

Block._id = 0;
Block._blocks = {};

Block.prototype.valueOf = function() {
    var id = this._id;
    if (!id) {
        id = this._id = '@block' + Block._id++ + '@';
        Block._blocks[id] = this;
    }

    return id;
};

// ----------------------------------------------------------------------------------------------------------------- //

Block.prototype.run = function(context) {
    var promise = new Promise();

    var before = this.before;
    if (before) {
        before(context);
    }

    var guard = this.guard;
    if (guard && !guard(context)) {
        promise.resolve( new Result.Value(null) ); // FIXME: Или же возвращать ошибку.
    } else {
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

Block.prototype.subblocks = function() {
    return [ this ];
};

Block.prototype.getResult = function(result) {
    return result.results[ result.index++ ];
};

// ----------------------------------------------------------------------------------------------------------------- //

Block.prototype.setPriority = function(priority) {
    this.priority = priority;
};

// ----------------------------------------------------------------------------------------------------------------- //

Block.prototype.getParams = function(context) {
    var params = this.options.params;

    return (params) ? params(context) : context.request;
};

// ----------------------------------------------------------------------------------------------------------------- //
// Block.Array
// ----------------------------------------------------------------------------------------------------------------- //

Block.Array = function(array, options) {
    this.setOptions(options);

    var blocks = this.blocks = [];

    for (var i = 0, l = array.length; i < l; i++) {
        blocks.push( Block.compile( array[i], options ) );
    }
};

$util.inherits( Block.Array, Block );

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

// ----------------------------------------------------------------------------------------------------------------- //
// Block.Object
// ----------------------------------------------------------------------------------------------------------------- //

Block.Object = function(object, options) {
    this.setOptions(options);

    var blocks = this.blocks = [];
    var keys = this.keys = [];

    for (var key in object) {
        blocks.push( Block.compile( object[key], options ) );
        keys.push(key);
    }
};

$util.inherits( Block.Object, Block );

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

// ----------------------------------------------------------------------------------------------------------------- //
// Block.File
// ----------------------------------------------------------------------------------------------------------------- //

Block.File = function(filename, options) {
    this.setOptions(options);

    this.filename = util.compileString(filename);
};

$util.inherits( Block.File, Block );

Block.File.prototype._run = function(promise, context) {
    var params = this.getParams(context);

    var filename = util.resolveFilename( this.dirname, this.filename(context) );

    $fs.readFile(filename, 'utf-8', function(error, result) {
        if (error) {
            promise.resolve( new Result.Error({
                id: 'FILE_OPEN_ERROR',
                message: error.message
            }) );
        } else {
            var ext = $path.extname(filename);
            if (ext === '.json') {
                promise.resolve( new Result(result) );
            } else {
                promise.resolve( new Result.Value(result) );
            }
        }
    });
};

// ----------------------------------------------------------------------------------------------------------------- //
// Block.Function
// ----------------------------------------------------------------------------------------------------------------- //

Block.Function = function(func, options) {
    this.func = func;
    this.setOptions(options);
};

$util.inherits( Block.Function, Block );

Block.Function.prototype._run = function(promise, context) {
    var result = this.func(context);

    var block = new Block.Root(result); // FIXME: Правильные options.
    block.run(context).then(function(result) {
        promise.resolve(result);
    });
};

// ----------------------------------------------------------------------------------------------------------------- //
// Block.Call
// ----------------------------------------------------------------------------------------------------------------- //

Block.Call = function(call, options) {
    this.setOptions(options);

    var r = call.match(/^(?:(.*?):)?(.*)\(\)$/);

    var module = r[1] || config.defaultModule;
    var method = this.method = r[2];

    module = modules[module];

    var call = module[method];
    this.call = (typeof call === 'function') ? call : module;
};

$util.inherits(Block.Call, Block);

Block.Call.prototype._run = function(promise, context) {
    this.call(promise, context);
};

// ----------------------------------------------------------------------------------------------------------------- //
// Block.Include
// ----------------------------------------------------------------------------------------------------------------- //

Block.Include = function(filename, options) {
    this.setOptions(options);

    this.filename = util.compileString(filename);
};

$util.inherits(Block.Include, Block);

Block.Include.prototype._run = function(promise, context) {
    var filename = util.resolveFilename( this.dirname, this.filename(context) );
    var dirname = $path.dirname(filename);

    $fs.readFile(filename, 'utf-8', function(error, content) {
        if (error) {
            promise.resolve( new Result.Error({
                id: 'FILE_OPEN_ERROR',
                message: error.message
            }) );
        } else {
            try {
                var include = $vm.runInNewContext( '(' + content + ')', sandbox, filename);

                var options = util.extends( {}, this.options, { dirname: dirname } );
                var root = new Block.Root(include, options);

                root.run(context).then( function(result) {
                    promise.resolve(result);
                } );
            } catch (e) {
                promise.resolve( new Result.Error({
                    id: 'FILE_EVAL_ERROR',
                    message: e.message
                }) );
            }

        }
    });
};

// ----------------------------------------------------------------------------------------------------------------- //
// Block.Http
// ----------------------------------------------------------------------------------------------------------------- //

Block.Http = function(url, options) {
    this.setOptions(options);

    if (/(\?|&)$/.test(url)) {
        this.extend = true;
        url = url.substr(0, url.length - 1);
    }

    this.url = util.compileString(url);
};

$util.inherits(Block.Http, Block);

Block.Http.prototype._run = function(promise, context) {
    var options = util.http.url2options(
        this.url(context),
        (this.extend) ? this.getParams(context) : null
    );

    util.http.get(options, function(result) {
        promise.resolve(result);
    });

};

// ----------------------------------------------------------------------------------------------------------------- //
// Block.Value
// ----------------------------------------------------------------------------------------------------------------- //

Block.Value = function(value, options) {
    this.setOptions(options);
    this.value = value;
};

$util.inherits(Block.Value, Block);

Block.Value.prototype._run = function(promise, params) {
    promise.resolve( new Result.Value(this.value) );
};

// ----------------------------------------------------------------------------------------------------------------- //
// Block.Root
// ----------------------------------------------------------------------------------------------------------------- //

Block.Root = function(root, options) {
    this.setOptions(options);

    this.root = Block.compile(root, options);

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

$util.inherits( Block.Root, Block );

Block.Root.prototype._run = function(promise, context) {
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

            Promise.wait(promises).then(run);

        } else {
            promise.resolve(that.root.getResult({
                results: results,
                index: 0
            }));
        }
    })();
};

// ----------------------------------------------------------------------------------------------------------------- //

Block.compile = function(block, options) {

    options = options || {};

    var compiled;
    var priority;

    switch (typeof block) {

        case 'string':

            var r;

            if (( r = /^http:\/\//.test(block) )) { // Строка начинается с 'http://' -- это http-блок.
                                                    // FIXME: Поддержка https, post, get и т.д.
                compiled = new Block.Http(block, options);

            } else if (( r = block.match(/^(.*\(\))(\d+)?$/) )) { // Строка оканчивается на '()' -- это call-блок.
                compiled = new Block.Call(r[1], options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.jsx)(\d+)?$/) )) { // Строка оканчивается на '.jsx' -- это include-блок.
                compiled = new Block.Include(r[1], options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.(?:json|txt|xml))(\d+)?$/) )) { // Строка оканчивается на '.json' -- это file-блок.
                compiled = new Block.File(r[1], options);
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

                compiled = Block._blocks[id];
                priority = r[2];

                delete Block._blocks[id];

            }

            break;

        case 'object':

            if (block instanceof Array) {
                compiled = new Block.Array(block, options);

            } else if (block && !(block instanceof Block)) {
                compiled = new Block.Object(block, options);

            } else {
                compiled = block;

            }

            break;

        case 'function':

            compiled = new Block.Function(block, options);

            break;

    }

    if (!compiled) {
        compiled = new Block.Value(block, options);
    }

    if (priority) {
        compiled.setPriority( +priority );
    }

    return compiled;

};

// ----------------------------------------------------------------------------------------------------------------- //

var sandbox = {};

// ----------------------------------------------------------------------------------------------------------------- //

sandbox.block = Block.compile;

sandbox.http = function(url, options) {
    return new Block.Http(url, options);
};

sandbox.file = function(filename, options) {
    return new Block.File(filename, options);
};

sandbox.include = function(filename, options) {
    return new Block.Include(filename, options);
};

sandbox.call = function(call, options) {
    return new Block.Call(call, options);
};

sandbox.array = function(array, options) {
    return new Block.Array(array, options);
};

sandbox.object = function(object, options) {
    return new Block.Object(object, options);
};

sandbox.value = function(value, options) {
    return new Block.Value(value, options);
};

sandbox.root = function(root, options) {
    return new Block.Root(root, options);
};

// ----------------------------------------------------------------------------------------------------------------- //

module.exports = Block;

// ----------------------------------------------------------------------------------------------------------------- //

