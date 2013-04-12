var de = require('./de.js');

require('./de.result.js');
require('./de.context.js');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var path_ = require('path');

//  ---------------------------------------------------------------------------------------------------------------  //
//  Vars and consts
//  ---------------------------------------------------------------------------------------------------------------  //

var _id = 0;
var _blocks = {};

//  Кэш результатов выполнения блоков. В кэше хранятся структуры вида:
//
//      {
//          //  Время добавления в кэш.
//          timestamp: ...,
//          //  promise, зарезолвленный инстансом de.Result.*.
//          promise: ...
//      }
//
var _results = {};

//  Кэш инклюдов, в кэше хранятся скомпилированные блоки.
var _includes = {};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block = function(block, options) {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.prototype._init = function(options) {
    this.priority = this.priority || 0;

    options = options || {};

    var _options = this.options = {};

    _options.dirname = options.dirname || de.config.rootdir;

    //  options.guard может быть либо функцией вида:
    //
    //      function guard(params, context) { ... }
    //
    //  либо строкой вида:
    //
    //      '.id == 42 && !state.foo'
    //
    _options.guard = compileBoolean(options.guard);

    //  Функция вида:
    //
    //      function before(params, context) { ... }
    //
    _options.before = options.before || null;

    //  Функция вида:
    //
    //      function after(params, context, result) { ... }
    //
    _options.after = options.after || null;

    //  Объект вида:
    //
    //      {
    //          foo: no.jpath.expr('.foo'),
    //          ...
    //      }
    //
    _options.select = compileObject(options.select);

    //  Функция вида:
    //
    //      function(result, context) { ... }
    //
    //  или jpath:
    //
    //      '.foo.bar'
    //
    //  или объект типа jresult:
    //
    //      {
    //          id: '.id',
    //          content: '.data'
    //      }
    //
    _options.result = compileExpr(options.result);

    //  То же, что и в options.result.
    _options.params = compileExpr(options.params);

    //  Функция с сигнатурой (params, context) или jstring.
    _options.key = compileString(options.key);
    //  Число миллисекунд, на которое нужно закэшировать блок.
    _options.maxage = de.duration(options.maxage || 0);

    //  Тип результата блока: json, text, ...
    //  FIXME: Дефолтный data_type?
    _options.data_type = options.data_type || '';

    //  Нужно ли преобразовать реальный тип во что-то еще.
    //  Например, text -> json.
    _options.output_type = options.output_type || '';

    //  Таймаут для блока.
    _options.timeout = options.timeout || 0;

    //  Имя файла с шаблоном, который нужно наложить на результат выполнения блока.
    _options.template = compileString(options.template);

    return _options;
};

function compileBoolean(expr) {
    if (expr == null) { return null; }

    return (typeof expr === 'function') ? expr : no.jpath.boolean(expr);
}

function compileExpr(expr) {
    if (expr == null) { return null; }

    return (typeof expr === 'function') ? expr : no.jpath.scalar(expr);
}

function compileString(str) {
    if (str == null) { return null; }

    return (typeof str === 'function') ? str : no.jpath.string(str);
}

function compileObject(obj) {
    if (obj == null) { return null; }

    if (typeof obj === 'function') { return obj; }

    var r = {};
    for (var key in obj) {
        r[key] = compileExpr( obj[key] );
    }
    return r;
}

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.prototype.resolveFilename = function(filename) {
    return path_.resolve(this.options.dirname, filename);
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.prototype.valueOf = function() {
    var id = this.__valueOf;
    if (!id) {
        id = this.__valueOf = '@block' + _id++ + '@';
        _blocks[id] = this;
    }

    return id;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.prototype.run = function(params, context) {
    context = context || new de.Context(params);

    var promise = new no.Promise();

    var options = this.options;

    //  Проверяем гвард, если он есть.
    if ( options.guard && !options.guard(params, context) ) {
        return promise.resolve( new de.Result.Value(null) );
    }

    if (options.before) {
        options.before(params, context);
    }

    var running;

    //  Смотрим, определен ли ключ для этого блока.
    var key;
    if (options.key) {
        //  Вычисляем ключ.
        key = options.key(params, context);

        //  Смотрим, не закэширован ли блок с таким же ключом.
        var cached = _results[key];
        if (cached) {
            //  Не протух ли еще наш кэш?
            if (cached.timestamp + options.maxage > context.now) {
                //  Нет, берем из кэша promise с результатом.
                running = cached.promise;
            } else {
                //  Протух. Выкидываем из кэша.
                //  FIXME: Может тут таки нужно делать delete.
                _results[key] = null;
            }
        }
    }

    if (!running) {
        //  Если блок все-таки не закэширован, запускаем его.
        var _params = (options.params) ? options.params(params, context) : params;
        var running = this._run(_params, context);

        //  Если определен таймаут для блока.
        if (options.timeout) {
            var hTimeout = null;

            //  Если блок выполнился быстрее, чем таймаут.
            running.done(function() {
                if (hTimeout) {
                    //  Отменяем setTimeout.
                    clearTimeout(hTimeout);
                    hTimeout = null;
                }
            });

            hTimeout = setTimeout(function() {
                //  Если через options.timeout ms ничего не случится, кидаем ошибку.
                running.reject( de.error({
                    id: 'TIMEOUT',
                    message: 'Timeout' // FIXME: Вменяемый текст.
                }) );

                //  И отменяем все запросы этого блока.
                //  Пока что отменяются только http-запросы.
                running.trigger('abort');

            }, options.timeout);
        }

        //  Кэша нет, но ключ есть.
        if (key) {
            //  Кэшируем блок на будущее.
            //  Можно не ждать окончания выполнения блока, т.к. там все равно promise кэшируется.
            _results[key] = {
                timestamp: context.now,
                promise: running
            };

            running.fail(function() {
                //  Если выполнение привело к ошибке, выкидываем ключ из кэша.
                //  Чтобы в следующий раз блок выполнился еще раз.
                //  FIXME: Может лучше использовать delete?
                results[key] = null;
            });
        }
    }

    var that = this;

    running.done(function(result) {
        //  Возможность положить что-нибудь в state после выполнения блока.
        var select = options.select;
        if (select) {
            var state = context.state;
            var obj = result.object();

            for (var key in select) {
                //  FIXME: Сигнатура?!
                state[key] = select[key](obj, context);
            }
        }

        if (options.after) {
            options.after(params, context, result);
        }

        if (options.result) {
            result = new de.Result.Value( options.result( result.object(), context, params ) );
        }

        if (options.template) {
            var filename = that.resolveFilename( options.template(params, context) );

            de.file.eval(filename)
                .done(function(template) {
                    var r = template( result.object() );

                    /*
                    if (data && typeof data === 'object') {
                        if ( Array.isArray(data) ) {
                            return new de.Result.Array(data);
                        } else {
                            return new de.Result.Object(data);
                        }
                    }
                    */
                    promise.resolve( new de.Result.HTML(r) );
                })
                .fail(function(error) {
                    promise.resolve(error);
                });
        } else {
            promise.resolve(result);
        }

    });

    running.fail(function(error) {
        promise.resolve(error);
    });

    return promise;
};

de.Block.prototype._run = function(params, context) {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.prototype.params = function(params) {
    return new de.Block.Curry(this, params);
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.compile = function(block, options) {
    // options = options || {};

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

            //  FIXME: Уметь задавать список расширений для file-блока через конфиг.
            } else if (( r = block.match(/^(.*\.(?:json|txt|html|xml))(\d+)?$/) )) { // Строка оканчивается на '.(json|txt|html|xml)' -- это file-блок.
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

            } else if (( r = block.match(/^(@block\d+@)(\d+)$/) ) || ( r = block.match(/^(\d+)(@block\d+@)$/) )) {
                // Строка вида '@block25@45' или '45@block25@',
                // где 25 это порядковый номер блока, а 45 -- приоритет.

                var id = r[1];
                priority = r[2];

                compiled = _blocks[id];

                delete _blocks[id];

            }

            break;

        case 'object':

            //  NOTE: Тут нельзя использовать (block instanceof Array) потому, что .jsx файлы эвалятся
            //  в другом контексте и там другой Array. Для справки -- util.isArray примерно в 10 раз медленнее, чем instanceof.
            if ( Array.isArray(block) ) {
                compiled = new de.Block.Array(block, options);

            } else if ( block && !(block instanceof de.Block) ) {
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
        compiled.priority = +priority;
    }

    return compiled;

};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.File
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File = function(filename, options) {
    this._init(options);

    this.filename = no.jpath.string(filename);
};

no.inherit(de.Block.File, de.Block);

de.Block.File.prototype._id = 'file';

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.File.prototype._run = function(params, context) {
    var filename = this.resolveFilename( this.filename(params, context) );

    var options = this.options;

    var promise = new no.Promise();

    de.file.get(filename)
        .done(function(result) {
            promise.resolve( new de.Result.Raw(result, options.data_type, options.output_type) );
        })
        .fail(function(error) {
            promise.resolve(error);
        });

    return promise;
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Http
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Http = function(url, options) {
    options = this._init(options);

    //  Пробрасывать ли http-заголовки.
    //  По дефолту -- пробрасывать.
    options.proxy = (options.proxy === undefined) ? true : options.proxy;

    var ch = url.slice(-1);
    //  Если урл заканчивается на '?' или '&', значит в запрос нужно добавить
    //  параметры из реквеста.
    if (ch === '?' || ch === '&') {
        options.extend = true;
        url = url.slice(0, -1);
    }

    this.url = no.jpath.string(url);
};

no.inherit(de.Block.Http, de.Block);

de.Block.Http.prototype._id = 'http';

//  ---------------------------------------------------------------------------------------------------------------  //

//  Список http-заголовков, которые нужно выкидывать при проксировании.
//  Стырено из xscript'а (наверное, они знали, что делали :).
//
var disallow_headers = {
    'host': true,
    'if-modified-since': true,
    'accept-encoding': true,
    'keep-alive': true,
    'connection': true,
    'content-length': true
};

de.Block.Http.prototype._run = function(params, context) {
    var url = this.url(params, context);

    var options = this.options;

    var query = (options.extend) ? params : null;

    var headers;
    if (options.proxy && context.request) {
        var req_headers = context.request.headers;

        //  Копируем все http-заголовки, кроме тех, которые указаны в disallow_headers.
        headers = {};
        for (var header in req_headers) {
            if (!disallow_headers[header]) {
                headers[header] = req_headers[header];
            }
        };
    } else {
        headers = null;
    }

    var promise = new no.Promise();

    de.http.get(url, query, headers)
        .done(function(result) {
            promise.resolve( new de.Result.Raw(result, options.data_type, options.output_type) );
        })
        .fail(function(error) {
            promise.reject(error);
        });

    return promise;
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Call
//  ---------------------------------------------------------------------------------------------------------------  //

//  FIXME: Нужна ли тут интерполяция строк?
//  Типа: 'get{ .method }()'
//
de.Block.Call = function(call, options) {
    this._init(options);

    var r = call.match(/^(?:(.*?):)?(.*)\(\)$/);

    this.module = de._modules[ r[1] || '' ] || null;
    this.method = r[2];
};

no.inherit(de.Block.Call, de.Block);

de.Block.Call.prototype._id = 'call';

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Call.prototype._run = function(params, context) {
    var module = this.module;
    var method = this.method;

    if (module) {
        var call = module[method] || module;
        try {
            return call(params, context, method);
        } catch (e) {
            return no.Promise.resolved( de.error({
                id: 'MODULE_CALL',
                message: e.message
            }) );
        }
    } else {
        return no.Promise.resolved( de.error({
            id: 'MODULE_NOT_FOUND',
            message: 'Cannot find module "' + this.moduleName + '"'
        }) );
    }
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Function
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Function = function(func, options) {
    this._init(options);

    this.func = func;
};

no.inherit(de.Block.Function, de.Block);

de.Block.Function.prototype._id = 'function';

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Function.prototype._run = function(params, context) {
    var result;
    try {
        result = this.func(params, context);
    } catch (e) {
        return no.Promise.resolved( de.error({
            id: 'FUNC_CALL',
            message: e.message
        }) );
    }

    var block = de.Block.compile( result, { dirname: this.options.dirname } );

    return block.run(params, context);
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Include
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Include = function(filename, options) {
    this._init(options);

    this.filename = no.jpath.string(filename);
};

no.inherit(de.Block.Include, de.Block);

de.Block.Include.prototype._id = 'include';

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Include.prototype._run = function(params, context) {
    var promise = new no.Promise();

    var filename = this.resolveFilename( this.filename(params, context) );

    var including = _includes[filename];
    if (!including) {
        including = _includes[filename] = new no.Promise();

        de.file.eval(filename, 'de', de.sandbox)
            .done(function(include) {
                var dirname = path_.dirname(filename);

                var options = no.extend( {}, that.options, { dirname: dirname } );
                including.resolve( de.Block.compile(include, options) );
            })
            .fail(function(error) {
                _includes[filename] = null;

                including.reject(error);
            });
    }

    including
        .done(function(block) {
            de.forward( block.run(params, context), promise );
            /*
            var running = block.run(params, context);

            running.pipe(promise);
            promise.forward('abort', running);
            */
        })
        .fail(function(error) {
            promise.resolve(error);
        });

    var that = this;

    return promise;
};

//  FIXME: Получается, что у нас в кэше лежит и исполненный код,
//  и созданный из него блок.
//
no.events.on('loaded-file-changed', function(e, filename) {
    _includes[filename] = null;
});


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Value
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Value = function(value, options) {
    this._init(options);

    this.value = new de.Result.Value(value);
};

no.inherit(de.Block.Value, de.Block);

de.Block.Value.prototype._id = 'value';

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Value.prototype._run = function(params, context) {
    return no.Promise.resolved(this.value);
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Array
//  ---------------------------------------------------------------------------------------------------------------  //

function groupItems(items) {
    var l = items.length;
    if (!l) {
        return [];
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

de.Block.Array = function(array, options) {
    options = this._init(options);

    var items = [];
    var item_options = { dirname: options.dirname };
    for (var i = 0, l = array.length; i < l; i++) {
        items.push({
            index: i,
            block: de.Block.compile(array[i], item_options)
        });
    }

    this.groups = groupItems(items);

};

no.inherit(de.Block.Array, de.Block);

de.Block.Array.prototype._id = 'array';

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array.prototype._run = function(params, context) {
    var promise = new no.Promise();

    var that = this;

    var results = [];
    var groups = this.groups;

    var i = 0;
    var l = groups.length;

    var workers;
    var wait;

    promise.on('abort', function() {
        //  Останавливаем run(), чтобы он не запускал больше ничего.
        i = l;

        promise.resolve( de.error({
            id: 'ERROR_ABORTED'
        }) );


        if (workers) {
            //  FIXME: Нужно ли это?
            wait.reject();

            for (var j = 0, m = workers.length; j < m; j++) {
                workers[j].trigger('abort');
            }
        }
    });

    (function run() {
        if (i < l) {
            workers = [];

            var group = groups[i];
            for (var j = 0, m = group.length; j < m; j++) {
                (function(item) {
                    var worker = item.block.run(params, context)
                        .done(function(r) {
                            results[item.index] = r;
                        });

                    workers.push(worker);
                })( group[j] );
            }

            i++;

            wait = no.Promise.wait(workers).done(run);

        } else {
            workers = null;

            promise.resolve( that._getResult(results) );
        }
    })();

    return promise;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array.prototype._getResult = function(results) {
    return new de.Result.Array(results);
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Object
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Object = function(object, options) {
    options = this._init(options);

    var items = [];
    var keys = this.keys = [];

    var i = 0;
    var item_options = { dirname: options.dirname };
    for (var key in object) {
        items.push({
            index: i++,
            block: de.Block.compile(object[key], item_options)
        });
        keys.push(key);
    }

    this.groups = groupItems(items);
};

no.inherit(de.Block.Object, de.Block);

de.Block.Object.prototype._id = 'object';

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Object.prototype._run = de.Block.Array.prototype._run;

de.Block.Object.prototype._getResult = function(results) {
    var keys = this.keys;

    var r = {};

    for (var i = 0, l = results.length; i < l; i++) {
        r[ keys[i] ] = results[i];
    }

    return new de.Result.Object(r);
};


/*
//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Block.Page
//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Page = function(page, options) {
    this._init(options);

    //  FIXME: Вообще может убрать дефолтный таймаут?
    this.options.timeout = this.options.timeout || de.config.timeout || 0;

    this.page = de.Block.compile(page, options);
};

no.inherit(de.Block.Page, de.Block);

de.Block.Page.prototype._id = 'page';

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Page.prototype._run = function(params, context) {
    return this.page.run(params, context);
};
*/

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Curry = function(block, params) {
    this.block = block;
    this.params = params;
};

no.inherit(de.Block.Curry, de.Block);

de.Block.Curry.prototype.run = function(params, context) {
    return this.block.run(this.params, context);
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Expr = function(expr, options) {
    this._init(options);

    this.expr = compileExpr(expr);
};

no.inherit(de.Block.Expr, de.Block);

de.Block.Expr.prototype._id = 'expr';

de.Block.Expr.prototype._run = function(params, context) {
    var promise = new no.Promise();

    promise.resolve( new de.Result.Value( this.expr(params, context) ) );

    return promise;
};

//  ---------------------------------------------------------------------------------------------------------------  //

