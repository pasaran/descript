var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block = function(block, descript, options) {};

//  ---------------------------------------------------------------------------------------------------------------  //

function compile(s) {
    if (s == null) { return null; }

    return (typeof s === 'function') ? s : no.jpath.compile(s);
}

de.Block.prototype._init = function(descript, options) {
    this.descript = descript;

    var _options = this.options = options || {};

    this.priority = 0;

    this.dirname = _options.dirname || descript.config.rootdir;

    //  Может быть либо функцией, либо строкой вида: '.id == 42 && !state.foo'
    var guard = compile(_options.guard);
    /*
    if (guard) {
        if (typeof guard === 'string') {
            //  Нужно скомпилировать в функцию. Т.е. можно писать так:
            //      guard: 'state.foo && !request.boo'
            this.guard = new Function('context', 'var state = context.state, request = context.request; return ' + guard + ';');
        } else {
            this.guard = guard;
        }
    }
    */

    var select = _options.select;
    if (select) {
        var _select = this.select = {};
        for (var key in select) {
            _select[key] = no.jpath.compile( select[key] );
        }
    }

    var result = compile(_options.result);
    /*
    if (result) {
        if (typeof result === 'function') {
            this.result = result;
        } else {
            this.result = no.jpath.compileExpr(result);
        }
    }
    */

    this.before = _options.before;
    this.after = _options.after;

    this.timeout = _options.timeout;

    if (_options.key && _options.maxage) {
        this.key = compile(_options.key);
        this.maxage = de.duration( _options.maxage );
    }

    this.params = _options.params;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.prototype.resolveFilename = function(filename) {
    if ( filename.charAt(0) !== '/' ) {
        filename = path_.resolve(this.dirname, filename);
    }
    //  FIXME: Проверять, что путь не вышел за пределы rootdir.

    return filename;
};

//  ---------------------------------------------------------------------------------------------------------------  //

var _id = 0;
var _blocks = {};

de.Block.prototype.valueOf = function() {
    var id = this._id;
    if (!id) {
        id = this._id = '@block' + _id++ + '@';
        _blocks[id] = this;
    }

    return id;
};

//  ---------------------------------------------------------------------------------------------------------------  //

var null_result = new de.Result.Value(null);
var null_promise = ( new no.Promise() ).resolve(null_result);

de.Block.prototype.run = function(context, params) {
    //  Проверяем гвард, если он есть.
    var th_guard = this.guard;
    if ( th_guard && !th_guard(params, context) ) {
        //  Если блок выполнять не нужно, возвращаем предопределенный promise,
        //  который зарезолвлен null'ом.
        return null_promise;
    }

    //  Возможность положить что-нибудь в стейт до выполнения блока.
    var th_before = this.before;
    if (th_before) {
        var state = context.state;
        for (var key in th_before) {
            state[key] = th_before[key](params, context);
        }
    }

    //  Вычисляем новые параметры (или берем старые).
    var th_params = this.params;
    params = (th_params) ? th_params(params, context) : params;

    var promise;
    var results = this.descript._results;

    var th_key = this.key;
    var key = null;
    var isCached = false;
    if (th_key) {
        key = th_key(params, context);

        var cached = results[key];
        if ( cached && (cached.timestamp + this.maxage > context.now) ) {
            promise = cached.promise;
            isCached = true;
        }
    }

    if (!promise) {
        promise = new no.Promise();

        if (key) {
            results[key] = {
                timestamp: context.now,
                promise: promise
            };

            promise.then(function(result) {
                if (result instanceof de.Result.Error) {
                    results[key] = null;
                }
            });
        }
    }

    var that = this;
    var timeout = null;
    var th_timeout = this.timeout;
    if (th_timeout) {
        promise.then(function() {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        });

        timeout = setTimeout(function() {
            promise.resolve( new de.Result.Error({
                id: 'TIMEOUT',
                message: 'Timeout' // FIXME: Вменяемый текст.
            }) );
            if (!isCached) {
                that.abort();
            }
        }, th_timeout);
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

    var th_after = this.after;
    if (th_after) {
        promise.then(function(result) {
            th_after(result, context);
        });
    }

    if (!isCached) {
        this._run(promise, context, params);
    }

    return promise;
};

de.Block.prototype._run = function(promise, context, params) {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.prototype.subblocks = function() {
    return [ this ];
};

de.Block.prototype.getResult = function(result) {
    return result.results[ result.index++ ];
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.prototype.setPriority = function(priority) {
    this.priority = priority;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.compile = function(block, descript, options) {

    // options = options || {};

    var compiled;
    var priority;

    switch (typeof block) {

        case 'string':

            var r;

            if (( r = /^http:\/\//.test(block) )) { // Строка начинается с 'http://' -- это http-блок.
                                                    // FIXME: Поддержка https, post, get и т.д.
                compiled = new de.Block.Http(block, descript, options);

            } else if (( r = block.match(/^(.*\(\))(\d+)?$/) )) { // Строка оканчивается на '()' -- это call-блок.
                compiled = new de.Block.Call(r[1], descript, options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.jsx)(\d+)?$/) )) { // Строка оканчивается на '.jsx' -- это include-блок.
                compiled = new de.Block.Include(r[1], descript, options);
                priority = r[2];

            } else if (( r = block.match(/^(.*\.(?:json|txt|xml))(\d+)?$/) )) { // Строка оканчивается на '.json' -- это file-блок.
                compiled = new de.Block.File(r[1], descript, options);
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

                compiled = _blocks[id];
                priority = r[2];

                delete _blocks[id];

            }

            break;

        case 'object':

            //  NOTE: Тут нельзя использовать (block instanceof Array) потому, что .jsx файлы эвалятся
            //  в другом контексте и там другой Array. Для справки -- util.isArray примерно в 10 раз медленнее, чем instanceof.
            if ( Array.isArray(block) ) {
                compiled = new de.Block.Array(block, descript, options);

            } else if ( block && !(block instanceof de.Block) ) {
                compiled = new de.Block.Object(block, descript, options);

            } else {
                compiled = block;

            }

            break;

        case 'function':

            compiled = new de.Block.Function(block, descript, options);

            break;

    }

    if (!compiled) {
        compiled = new de.Block.Value(block, descript, options);
    }

    if (priority) {
        compiled.setPriority( +priority );
    }

    return compiled;

};

//  ---------------------------------------------------------------------------------------------------------------  //

