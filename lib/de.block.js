var de = require('../de.js');

require('.de.result.js');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var fs_ = require('fs');
var path_ = require('path');
var url_ = require('url');
var http_ = require('http');

//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block
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

//  FIXME: Не очень подходящее название, кажется.
de.Block.prototype.fork = function(params, context, promise) {
    var worker = this.run(params, context).pipe(promise);

    promise.forward('abort', worker);
};



//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Array
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array = function(array, descript, options) {
    this._init(descript, options);

    var items = [];
    for (var i = 0, l = array.length; i < l; i++) {
        items.push({
            index: i,
            block: de.Block.compile(array[i], descript, options)
        });
    }

    this.groups = groupItems(items);

    function groupItems(items) {
        var l = items.length;
        if (!l) {
            return [ [] ];
        }

        var sorted = items.sort(function(a, b) { return b.block.priority - a.block.priority; });

        var groups = [];
        var group = [];

        var i = 0;
        var item = sorted[0];
        var next;
        while (i < l) {
            group.push(item);

            i++;
            if (i < l) {
                next = sorted[i];
                if (item.block.priority !== next.block.priority) {
                    groups.push(group);
                    group = [];
                }
            } else {
                groups.push(group);
                break;
            }

            item = next;
        }

        return groups;
    };

};

no.inherit(de.Block.Array, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array.prototype._run = function(promise, params, context) {
    var that = this;

    var results = [];
    var groups = this.groups;

    var i = 0;
    var l = groups.length;

    var workers;
    var promises;
    var wait;

    promise.on('abort', function() {
        if (workers) {
            wait.reject();

            for (var j = 0, m = workers.length; j < m; j++) {
                workers[j].trigger('abort');
            }

            //  FIXME: Что тут нужно вернуть-то?
            promise.resolve(null);

            i = l;
        }
    });

    (function run() {
        if (i < l) {
            promises = [];
            workers = [];

            var group = groups[i];
            for (var j = 0, m = group.length; j < m; j++) {
                (function(item) {
                    var worker = item.block.run(params, context)
                        .then(function(r) {
                            results[item.index] = r;
                        });

                    workers.push(worker);
                    promises.push(worker.promise);
                })( group[j] );
            }

            i++;

            wait = no.Promise.wait(promises).then(run);

        } else {
            //  FIXME: Нужно ли это вообще?
            worker.off('abort');

            worker.promise.resolve( that.root._getResult(results) );
        }
    })();

    return worker;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array.prototype._getResult = function(results) {
    return new de.Result.Array(results);
};



//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Call
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Call = function(call, descript, options) {
    this._init(descript, options);

    var r = call.match(/^(?:(.*?):)?(.*)\(\)$/);

    var module = r[1] || '';
    var method = this.method = r[2];

    module = descript.modules[module];

    call = module[method];
    this.call = (typeof call === 'function') ? call : module;
};

no.inherit(de.Block.Call, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Call.prototype._run = function(params, context) {
    this.call(params, context, this.descript, this.method);
};



//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.File
//  ---------------------------------------------------------------------------------------------------------------  //

//  Кэш с уже считанными файлами (или файлы, которые в процессе чтения).
//  В кэше хранятся инстансы de.Result.*.
var _cache = {};

//  За какими файлами мы уже следим (чтобы не делать повторный watch).
var _watched = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File = function(filename, descript, options) {
    this._init(descript, options);

    this.filename = no.jpath.compileString(filename);
    this.datatype = options.datatype;
};

no.inherit(de.Block.File, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File.prototype._run = function(promise, params, context) {
    var filename = this.filename(params, context);

    var datatype = this.datatype;
    if (!datatype) {
        var ext = path_.extname(filename);

        switch (ext) {
            case '.json':
                datatype = 'json';
                break;
        }
    }

    var result = _cache[filename];
    if (result) {
        //  FIXME: Если вдруг будет два запроса к одному файлу, но с разным datatype,
        //  то выйдет не очень хорошо.
        promise.resolve(result);
    } else {
        fs_.readFile(filename, function(error, content) {
            if (error) {
                //  Если не удалось считать файл, в следующий раз нужно повторить попытку,
                //  а не брать из кэша ошибку.
                _cache[filename] = null;

                promise.resolve( new de.Result.Error({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                }) );
            } else {
                //  Содержимое файла будет закэшировано внутри promise'а.
                //  Следим, не изменился ли файл.
                watchFile(filename);

                var result = new de.Result.Raw( [ content ], datatype );
                _cache[filename] = result;

                promise.resolve(result);
            }
        });
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.events.on('file-changed', function(e, filename) {
    //  Файл изменился, выкидываем его из кэша.
    _cache[filename] = null;

    // FIXME: Не нужно ли тут делать еще и unwatch?
});

//  ---------------------------------------------------------------------------------------------------------------  //

//  FIXME: Что произойдет, если нодовский процесс завершится,
//  но явно никто не вызовет unwatch?
//
function watchFile(filename) {
    //  FIXME: Непонятно, как это будет жить, когда файлов будет много.
    if ( !_watched[filename] ) {
        _watched[filename] = true;

        fs_.watchFile(filename, function (curr, prev) {
            if ( prev.mtime.getTime() !== curr.mtime.getTime() ) {
                no.events.trigger('file-changed', filename);
            }
        });
    }
};



//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Function
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Function = function(func, descript, options) {
    this._init(descript, options);

    this.func = func;
};

no.inherit(de.Block.Function, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Function.prototype._run = function(promise, params, context) {
    var result = this.func(context, params);

    //  FIXME: Правильные options.
    var block = new de.Block.compile(result);

    block.fork(promise, params, context);
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Http
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Http = function(url, descript, options) {
    this._init(descript, options);

    var ch = url.slice(-1);
    if (ch === '?' || ch === '&') {
        this.extend = true;
        url = url.slice(0, -1);
    }

    this.url = no.jpath.compileString(url);
    this.datatype = options.datatype;
};

no.inherit(de.Block.Http, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Http.prototype._run = function(promise, params, context) {
    var url = this.url(params, context);

    var worker = (new no.Promise() )
        .then(function(result) {
            promise._request = null;
            promise.resolve( new de.Result.Raw(result, datatype) );
        })
        .else_(function(error) {
            promise._request = null;
            promise.resolve( new de.Result.Error(error) );
        })
        .on('abort', function() {
            if (this._request) {
                this._request.abort();
                //  FIXME: Нужно ли это?
                this._request = null;
            }
        });
        //  FIXME: В какой момент нужно сделать worker.off('abort')?
        //  Или это не нужно совсем?

    promise.forward('abort', worker);

    var options = url_.parse(url, true, true);
    if (this.extend) {
        no.extend(options.query, params);
    }

    run(options, worker, 0);
};

// ----------------------------------------------------------------------------------------------------------------- //

var errorMessages = {
    '400': 'Bad Request',
    '403': 'Forbidden',
    '404': 'Not Found',
    '500': 'Internal Server Error',
    '503': 'Service Unavailable'
};

//  ---------------------------------------------------------------------------------------------------------------  //

function run(options, promise, count) {
    var data = [];

    var req = promise._request = http_.request(options, function(res) {
        var status = res.statusCode;

        var error;
        switch (status) {
            //  TODO: Кэшировать 301 запросы.
            case 301:
            case 302:
                //  FIXME: MAX_REDIRECTS.
                if (count > 3) {
                    return promise.resolve({
                        'id': 'HTTP_TOO_MANY_REDIRECTS'
                    });
                }

                var location = res.headers['location'] || '';
                var redirect = url_.resolve(options.href, location);

                options = url_.parse(redirect, true, true);

                return run(options, promise, count + 1);

            case 400:
            case 403:
            case 404:
            case 500:
            case 503:
                return promise.resolve({
                    'id': 'HTTP_' + status,
                    'message': errorMessages[status]
                });

            //  TODO: default:
        }

        res.on('data', function(chunk) {
            data.push(chunk);
        });
        res.on('end', function() {
            promise.resolve(data);
        });
        res.on('close', function(error) {
            promise.resolve({
                'id': 'HTTP_CONNECTION_CLOSED',
                'message': error.message
            });
        });

    });

    req.on('error', function(error) {
        promise.resolve({
            'id': 'HTTP_UNKNOWN_ERROR',
            'message': error.message
        });
    });

    req.end();
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Include
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Include = function(filename, descript, options) {
    this._init(descript, options);

    this.filename = no.jpath.compileString(filename);
};

no.inherit(de.Block.Include, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

var _cache = {};

de.Block.Include.prototype._run = function(promise, params, context) {
    var filename = this.resolveFilename( this.filename(params, context) );

    var block = _cache[filename];
    if (block) {
        return block.fork(promise, params, context);
    }

    var that = this;
    var descript = this.descript;

    fs_.readFile(filename, function(error, content) {
        if (error) {
            promise.resolve( new de.Result.Error(error) );

        } else {
            try {
                //  FIXME: Защита от модификации sandbox.
                var include = vm_.runInNewContext('(' + content + ')', descript.sandbox, filename);

                var dirname = path_.dirname(filename);

                var options = no.extend( {}, that.options, { dirname: dirname } );
                var block = _cache[filename] = new de.Block.compile(include, descript, options);

                block.fork(promise, params, context, promise);

            } catch (e) {
                promise.resolve( new de.Result.Error({
                    id: 'FILE_EVAL_ERROR',
                    message: e.message
                }) );
                /// throw e;
            }
        }
    });
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.events.on('file-changed', function(e, filename) {
    _cache[filename] = null;
});


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Object
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Object = function(object, descript, options) {
    this._init(descript, options);

    var items = [];
    var keys = this.keys = [];

    for (var key in object) {
        blocks.push({
            index: i,
            block: de.Block.compile(object[key], descript, options)
        });
        keys.push(key);
    }

    this.groups = this._groupItems(items);
};

no.inherit(de.Block.Object, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Object.prototype._groupItems = de.Block.Array.prototype._groupItems;
de.Block.Object.prototype._run = de.Block.Array.prototype._run;

de.Block.Object.prototype._getResult = function(results) {
    var keys = this.keys;

    var r = {};

    for (var i = 0, l = results.length; i < l; i++) {
        r[ keys[i] ] = results[i];
    }

    return new de.Result.Object(r);
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Value
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Value = function(value, descript, options) {
    this._init(descript, options);

    this.value = value;
};

no.inherit(de.Block.Value, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Value.prototype._run = function(promise, params, context) {
    //  FIXME: Нельзя ли сразу в конструкторе создать de.Result.Value?
    return promise.resolve( new de.Result.Value(this.value) );
};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = de.Block;

//  ---------------------------------------------------------------------------------------------------------------  //

