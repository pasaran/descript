/**
    @suppress {duplicate}
    @noalias
*/
var no = {};

// ------------------------------------------------------------------------------------------------------------- //
// no.array
// ------------------------------------------------------------------------------------------------------------- //

no.array = {};

// ------------------------------------------------------------------------------------------------------------- //

/**
    @param {Array} array
    @param {function(*): boolean} condition
    @return {number}
*/
no.array.firstMatch = function(array, condition) {
    for (var i = 0, l = array.length; i < l; i++) {
        if (condition( array[i] )) {
            return i;
        }
    }

    return -1;
};

// ------------------------------------------------------------------------------------------------------------- //
// no.events
// ------------------------------------------------------------------------------------------------------------- //

no.events = {};

// ------------------------------------------------------------------------------------------------------------- //

/**
    Тип для обработчиков событий.
    @typedef {function(string, *=)}
*/
no.events.type_handler;

// ------------------------------------------------------------------------------------------------------------- //

/**
    Внутренний кэш обработчиков событий.
    @type {Object.<string, Array.<no.events.type_handler>>}
*/
no.events._handlers = {};

/**
    @type {number}
*/
no.events._hid = 1;

/**
    @const
*/
no.events._hid_key =  no.events._hid_key ;

// ------------------------------------------------------------------------------------------------------------- //

/**
    Возвращает список обработчиков события name.
    Если еще ни одного обработчика не забинжено, возвращает (и сохраняет) пустой список.

    @param {string} name
    @return {Array.<no.events.type_handler>}
*/
no.events._get = function(name) {
    var handlers = no.events._handlers[name];
    if (!handlers) {
        handlers = no.events._handlers[name] = [];
    }
    return handlers;
};

// ------------------------------------------------------------------------------------------------------------- //

/**
    Подписываем обработчик handler на событие name.

    @param {string} name
    @param {no.events.type_handler} handler
*/
no.events.bind = function(name, handler) {
    var handlers = no.events._get(name);

    var hid = handler[ no.events._hid_key ];
    if (!hid) {
        handler[ no.events._hid_key ] = no.events._hid++;
    } else {
        var i = no.array.firstMatch(handlers, function(handler) { // Ищем этот обработчик среди уже подписанных.
            return (hid === handler[ no.events._hid_key ]);
        });
        if (i !== -1) { return; } // Этот обработчик уже подписан.
    }

    handlers.push(handler);
};

/**
    Отписываем обработчик handler от события name.
    Если не передать handler, то удалятся вообще все обработчики события name.

    @param {string} name
    @param {no.events.type_handler=} handler
*/
no.events.unbind = function(name, handler) {
    if (handler) {
        var hid = handler[ no.events._hid_key ];

        var handlers = no.events._get(name);
        var i = no.array.firstMatch(handlers, function(_handler) { // Ищем этот хэндлер среди уже забинженных обработчиков этого события.
            return hid === _handler._hid;
        });

        if (i !== -1) {
            handlers.splice(i, 1); // Нашли и удаляем этот обработчик.
        }
    } else {
        delete no.events._handlers[name]; // Удаляем всех обработчиков этого события.
    }
};

// ------------------------------------------------------------------------------------------------------------- //

/**
    "Генерим" событие name. Т.е. вызываем по-очереди (в порядке подписки) все обработчики события name.
    В каждый передаем name и params.
    Если какой-то обработчик вернул false, то остальные обработчики не вызываются.

    @param {string} name
    @param {*=} params
*/
no.events.trigger = function(name, params) {
    var handlers = no.events._get(name).slice(0); // Копируем список хэндлеров. Если вдруг внутри какого-то обработчика будет вызван unbind,
                                                  // то мы не потеряем вызов следующего обработчика.
    for (var i = 0, l = handlers.length; i < l; i++) {
        if (handlers[i](name, params) === false) { return; } // Если обработчик вернул false, то прекращаем дальнейшую обработку.
    }
};

// ----------------------------------------------------------------------------------------------------------------- //
// no.Promise
// ----------------------------------------------------------------------------------------------------------------- //

/**
    Объект, обещающий вернуть некий результат в будущем.
    Обычно результат получается в результате некоторых асинхронных действий.

    В сущности, это аналог обычных callback'ов, но более продвинутый.
    А точнее, это событие, генерящееся при получении результата и на которое
    можно подписаться:

        var promise = new no.Promise();

        promise.then(function(result) { // Подписываемся на получение результата.
            console.log(result); // 42
        });

        // И где-то дальше:
        ... promise.resolve(42); // Рассылаем результат всем подписавшимся.

    Можно подписать на результат несколько callback'ов:

        promise.then(function(result) { // Все методы then, else_, resolve, reject и wait -- chainable.
            // Сделать что-нибудь.
        }).then(function(result) {
            // Сделать что-нибудь еще.
        });

    Можно подписываться на результат даже после того, как он уже получен:

        var promise = new no.Promise();
        promise.resolve(42);

        promise.then(function(result) { // callback будет выполнен немедленно.
            console.log(result); // 42
        });

    Имея список из нескольких promise'ов, можно создать новый promise,
    которое зарезолвится только после того, как зарезолвятся все promise'ы из списка:

        var p1 = new no.Promise();
        var p2 = new no.Promise();

        var p = no.Promise.wait([ p1, p2 ]);
        p.then(function(result) { // В result будет массив из результатов p1 и p2.
            console.log(result); // [ 42, 24 ]
        });

        p2.resolve(24); // Порядок, в котором резолвятся promise'ы из списка не важен.
                        // При это в результате порядок будет тем же, что и promise'ы в wait([ ... ]).
        p1.resolve(42);

    К методам then/resolve есть парные методы else_/reject для ситуации, когда нужно вернуть
    не результат, а какую-нибудь ошибку.

        var p1 = new no.Promise();
        var p2 = new no.Promise();

        var p = no.Promise.wait([ p1, p2 ]);
        p.else_(function(error) {
            console.log(error); // 'Foo!'
        });

        p1.resolve(42);
        p2.reject('Foo!'); // Если режектится любой promise из списка, p тоже режектится.

    @constructor
*/
no.Promise = function() {
    this.thens = [];
    this.elses = [];
};

// ----------------------------------------------------------------------------------------------------------------- //

// NOTE: Да, ниже следует "зловещий копипаст". Методы then/else_ и resolve/reject совпадают почти дословно.
//       Альтернатива в виде прокладки, реализующей только then/resolve (как, например, в jQuery), мне не нравится.

/**
    Добавляем callback, ожидающий обещанный результат.
    Если promise уже зарезолвился, callback выполняется немедленно.

    @param {function(*)} callback
    @return {no.Promise}
*/
no.Promise.prototype.then = function(callback) {
    if (this.rejected) { return null; }

    if (this.resolved) {
        callback(this.result);
    } else {
        this.thens.push(callback);
    }

    return this;
};

/**
    Тоже самое, что и then.

    @param {function(*)} callback
    @return {no.Promise}
*/
no.Promise.prototype.else_ = function(callback) {
    if (this.resolved) { return null; }

    if (this.rejected) {
        callback(this.result);
    } else {
        this.elses.push(callback);
    }

    return this;
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    Передать результат всем подписавшимся.

    @param {*} result
    @return {no.Promise}
*/
no.Promise.prototype.resolve = function(result) {
    if (!(this.resolved || this.rejected)) {
        this.resolved = true;
        this.result = result;

        var thens = this.thens;
        for (var i = 0, l = thens.length; i < l; i++) {
            thens[i](result);
        }
        this.thens = this.elses = null;
    }

    return this;
};

/**
    Тоже самое, что и resolve.

    @param {*} error
    @return {no.Promise}
*/
no.Promise.prototype.reject = function(error) {
    if (!(this.rejected || this.resolved)) {
        this.rejected = true;
        this.error = error;

        var elses = this.elses;
        for (var i = 0, l = elses.length; i < l; i++) {
            elses[i](error);
        }
        this.thens = this.elses = null;
    }

    return this;
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    Создать из массива promise'ов новый promise, который зарезолвится только после того,
    как зарезолвятся все promise'ы из списка. Результатом будет массив результатов.

    @param {Array.<no.Promise>} promises
    @return {no.Promise}
*/
no.Promise.wait = function(promises) {
    var wait = new no.Promise();

    var results = [];
    var l = promises.length;
    var n = l;
    for (var i = 0; i < l; i++) {
        (function(promise, i) { // Замыкание, чтобы сохранить значения promise и i.

            promise.then( function(result) {
                results[i] = result;
                if (!--n) {
                    wait.resolve(results);
                }
            } );

            promise.else_( function(error) {
                // FIXME: Может тут нужно сделать results = null; ?
                wait.reject(error);
            } );

        })(promises[i], i);

    };

    return wait;
};

// ----------------------------------------------------------------------------------------------------------------- //

var de = {};

de.config = {};
de.modules = {};

// ----------------------------------------------------------------------------------------------------------------- //

var node = {};

// ----------------------------------------------------------------------------------------------------------------- //

/** @type {nodeFs} */
node.fs = require('fs');

// ----------------------------------------------------------------------------------------------------------------- //

/** @type {nodeHttp} */
node.http = require('http');

// ----------------------------------------------------------------------------------------------------------------- //

/** @type {nodePath} */
node.path = require('path');

// ----------------------------------------------------------------------------------------------------------------- //

/** @type {nodeUrl} */
node.url = require('url');

// ----------------------------------------------------------------------------------------------------------------- //

/** @type {nodeUtil} */
node.util = require('util');

// ----------------------------------------------------------------------------------------------------------------- //

/** @type {nodeVm} */
node.vm = require('vm');

// ----------------------------------------------------------------------------------------------------------------- //

/** @type {nodeQueryString} */
node.querystring = require('querystring');

// ----------------------------------------------------------------------------------------------------------------- //

/** @typedef {!Object} */
node.Buffer;

/** @typedef {!Object} */
node.Stream;

/** @typedef {!Object} */
node.Response;

/** @typedef {!Object} */
node.Request;

// ----------------------------------------------------------------------------------------------------------------- //

// ----------------------------------------------------------------------------------------------------------------- //
// de.util
// ----------------------------------------------------------------------------------------------------------------- //

de.util = {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {!Object} dest
    @param {...!Object} srcs
    @return {!Object}
*/
de.util.extend = function(dest, srcs) {
    for (var i = 1, l = arguments.length; i < l; i++) {
        var src = arguments[i];
        for (var key in src) {
            dest[key] = src[key];
        }
    }

    return dest;
};

// ----------------------------------------------------------------------------------------------------------------- //

de.util.resolveFilename = function(dirname, filename) {
    var root = de.config['rootdir'];

    if (/^\//.test(filename)) { // Absolute path.
        filename = node.path.join(root, filename);
    } else {
        filename = node.path.resolve(dirname, filename);
        // FIXME: Проверить, что путь не вышел за пределы root'а.
    }

    return filename;
};

// ----------------------------------------------------------------------------------------------------------------- //

de.util.compileString = function(string) {
    var parts = string.split(/{(.*?)}/g);

    var body = [];
    for (var i = 0, l = parts.length; i < l; i++) {
        var part = parts[i];

        if (i % 2) {
            var r = part.match(/^(state|config)\.(.*)$/);
            if (r) {
                body.push(r[1] + '["' + r[2] + '"]');
            } else {
                body.push('request["' + part + '"]');
            }
        } else {
            body.push('"' + part + '"');
        }
    }

    return new Function('context', 'var state = context.state, request = context.request, config = context.config; return ' + body.join('+'));
};

de.util.compileJPath = function(string) {
    var parts = string.split(/\./g);

    var body = '';
    for (var i = 0, l = parts.length; i < l; i++) {
        var r = parts[i].match(/^(.+?)(\[\d+\])?$/);
        body += 'if (!r) return null;r = r["' + r[1] + '"];';
        if (r[2]) {
            body += 'if (!r) return null;r = r' + r[2] + ';';
        }
    }

    return new Function('r', body + 'return r;');
};

// ----------------------------------------------------------------------------------------------------------------- //

de.util.parseCookies = function(cookie) {
    var cookies = {};

    var parts = cookie.split(';');
    for (var i = 0, l = parts.length; i < l; i++) {
        var r = parts[i].match(/^\s*([^=]+)=(.*)$/);
        if (r) {
            cookies[ r[1] ] = r[2];
        }
    }

    return cookies;
};

// ----------------------------------------------------------------------------------------------------------------- //

de.util.duration = function(s) {
    if (typeof s === 'number') {
        return s;
    }

    var parts = s.split(/(\d+)([dhms])/);
    var d = 0;

    for (var i = 0, l = parts.length; i < l; i += 3) {
        var n = +parts[i + 1];

        switch (parts[i + 2]) {
            case 'd':
                d += n * (60 * 60 * 24);
                break;
            case 'h':
                d += n * (60 * 60);
                break;
            case 'm':
                d += n * (60);
                break;
            case 's':
                d += n;
                break;
        }
    }

    return d * 1000;
};

// ----------------------------------------------------------------------------------------------------------------- //

// ----------------------------------------------------------------------------------------------------------------- //
// de.file
// ----------------------------------------------------------------------------------------------------------------- //

de.file = {};

// ----------------------------------------------------------------------------------------------------------------- //

de.file._cache = {};
de.file._watched = {};

// FIXME: Сейчас файл кэшируется навечно, что неправильно.
//        Нужно или кэшировать на некоторое время (5 минут, например),
//        или же следить за изменениями файла.

de.file.get = function(filename) {
    var promise = de.file._cache[filename];

    if (!promise) {
        promise = de.file._cache[filename] = new no.Promise();

        node.fs.readFile(filename, function(error, content) {
            if (error) {
                promise.reject({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                });
            } else {
                promise.resolve(content);
            }
        });

        if (!de.file._watched[filename]) { // FIXME: Непонятно, как это будет жить, когда файлов будет много.
            de.file._watched[filename] = true;

            // При изменении файла, удаляем его из кэша.
            node.fs.watchFile(filename, function (/** @type {{mtime: Date}} */ curr, /** @type {{mtime: Date}} */ prev) {
                if (curr.mtime !== prev.mtime) {
                    no.events.trigger('file-changed', filename);
                }
            });
        }
    }

    return promise;
};

no.events.bind('file-changed', function(e, filename) {
    /** @type {string} */ filename;

    delete de.file._cache[ filename ];
});

// ----------------------------------------------------------------------------------------------------------------- //
// de.http
// ----------------------------------------------------------------------------------------------------------------- //

de.http = {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {string} url
    @param {Object=} params
    @return {!Object}
*/
de.http.url2options = function(url, params) {
    url = node.url.parse(url, true);

    var query = url.query || {};
    if (params) {
        de.util.extend(query, params);
    }

    return {
        'host': url.hostname,
        'path': node.url.format({
            'pathname': url.pathname,
            'query': query
        }),
        'port': url.port || 80
    };
};

// ----------------------------------------------------------------------------------------------------------------- //

de.http.errorMessages = {
    '400': 'Bad Request',
    '403': 'Forbidden',
    '404': 'Not Found',
    '500': 'Internal Server Error',
    '503': 'Service Unavailable'
};

// ----------------------------------------------------------------------------------------------------------------- //

de.http.get = function(url) {
    var promise = new no.Promise();

    de.http._get(url, promise, 0);

    return promise;
};

de.http._get = function(options, promise, count) {
    var data = [];

    var req = node.http.request( options, function(res) {
        var headers = res.headers;
        var status = res.statusCode;

        var error;
        switch (status) {
            case 301:
            case 302:
                if (count > 3) { // FIXME: MAX_REDIRECTS.
                    return promise.reject({
                        'id': 'HTTP_TOO_MANY_REDIRECTS'
                    });
                }

                var location = headers['location'];
                var redirect = de.http.url2options(location);
                if (!redirect.host) {
                    redirect.host = options.host;
                }
                return de.http._get(redirect, promise, count + 1);

            case 400:
            case 403:
            case 404:
            case 500:
            case 503:
                error = {
                    'id': 'HTTP_' + status,
                    'message': de.http.errorMessages[status]
                };
                break;

            // TODO: default:
        }

        if (error) {
            promise.reject(error);

        } else {
            res.on('data', function(chunk) {
                data.push(chunk);
            });
            res.on('end', function() {
                promise.resolve(data);
            });
            res.on('close', function(error) {
                promise.reject({
                    'id': 'HTTP_CONNECTION_CLOSED',
                    'message': error.message
                });
            });

        }
    } );

    req.on('error', function(error) {
        promise.reject({
            'id': 'HTTP_UNKNOWN_ERROR',
            'message': error.message
        });
    });

    req.end();
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Options
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
de.Options;

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {*} block
    @param {de.Options=} options
*/
de.Block = function(block, options) {};

/**
    @param {de.Options=} options
*/
de.Block.prototype.setOptions = function(options) {
    var _options = this.options = options || {};

    this.priority = 0;

    this.dirname = _options.dirname || de.config['rootdir'];

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
            select[key] = de.util.compileJPath(select[key]);
        }
        this.select = select;
    }

    this.before = _options.before;
    this.after = _options.after;

    this.timeout = _options.timeout;

    if (_options.key && _options.maxage !== undefined) {
        this.key = _options.key;
        this.maxage = de.util.duration( _options.maxage );
    }
};

// ----------------------------------------------------------------------------------------------------------------- //

de.Block._id = 0;

/** @type {!Object.<string, de.Block>} */
de.Block._blocks = {};

/**
    @return {string}
*/
de.Block.prototype.valueOf = function() {
    var id = this._id;
    if (!id) {
        id = this._id = '@block' + de.Block._id++ + '@';
        de.Block._blocks[id] = this;
    }

    return id;
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {de.Context} context
    @return {no.Promise}
*/
de.Block.prototype.run = function(context) {
    var promise;
    var isCached;

    var before = this.before; // FIXME: На закэшированные блоки before не окажет никакого влияния.
    if (before) {
        before(context);
    }

    var guard = this.guard;
    if (guard && !guard(context)) {
        promise = new no.Promise();
        promise.resolve( new de.Result.Value(null) ); // FIXME: Или же возвращать ошибку.

    } else {
        var key = this.key;
        if (key) {
            var cached = de.Result._cache[key];
            if ( cached && (cached.timestamp + this.maxage > context.now) ) {
                promise = cached.promise;
                isCached = true;
            }
        }

        if (!promise) {
            promise = new no.Promise();

            if (key) {
                de.Result._cache[key] = {
                    timestamp: context.now,
                    promise: promise
                };

                promise.then(function(result) {
                    if (result instanceof de.Result.Error) {
                        delete de.Result._cache[key];
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
                promise.resolve( new de.Result.Error({
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

        if (!isCached) {
            this._run(promise, context);
        }
    }

    return promise;
};

/**
    @param {no.Promise} promise
    @param {de.Context} context
*/
de.Block.prototype._run = function(promise, context) {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @return {Array.<de.Block>}
*/
de.Block.prototype.subblocks = function() {
    return [ this ];
};

/**
    @param {{ results: Array.<de.Result>, index: number }} result
    @return {de.Result}
*/
de.Block.prototype.getResult = function(result) {
    return result.results[ result.index++ ];
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {number} priority
*/
de.Block.prototype.setPriority = function(priority) {
    this.priority = priority;
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Array
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {Array} array
    @param {de.Options=} options
    @extends {de.Block}
*/
de.Block.Array = function(array, options) {
    this.setOptions(options);

    var blocks = this.blocks = [];

    for (var i = 0, l = array.length; i < l; i++) {
        blocks.push( de.Block.compile( array[i], options ) );
    }
};

node.util.inherits( de.Block.Array, de.Block );

/** @override */
de.Block.Array.prototype.subblocks = function() {
    var subblocks = [];

    var blocks = this.blocks;
    for (var i = 0, l = blocks.length; i < l; i++) {
        subblocks = subblocks.concat( blocks[i].subblocks() );
    }

    return subblocks;
};

/** @override */
de.Block.Array.prototype.getResult = function(result) {
    var blocks = this.blocks;
    var r = [];

    for (var i = 0, l = blocks.length; i < l; i++) {
        r.push( blocks[i].getResult(result) );
    }

    return new de.Result.Array(r);
};

/** @override */
de.Block.Array.prototype.setPriority = function(priority) {
    var blocks = this.blocks;

    for (var i = 0, l = blocks.length; i < l; i++) {
        blocks[i].priority += priority;
    }
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Object
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {Object} object
    @param {de.Options=} options
    @extends {de.Block}
*/
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

/** @override */
de.Block.Object.prototype.subblocks = de.Block.Array.prototype.subblocks;

/** @override */
de.Block.Object.prototype.setPriority = de.Block.Array.prototype.setPriority;

/** @override */
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

/**
    @constructor
    @param {string} filename
    @param {de.Options=} options
    @extends {de.Block}
*/
de.Block.File = function(filename, options) {
    this.setOptions(options);

    this.filename = de.util.compileString(filename);
};

node.util.inherits( de.Block.File, de.Block );

/** @override */
de.Block.File.prototype._run = function(promise, context) {
    var filename = de.util.resolveFilename( this.dirname, this.filename(context) );

    de.file.get(filename)
        .then(function(result) {
            promise.resolve( new de.Result.Raw([ result ], true) ); // FIXME: Учесть options.dataType.
        })
        .else_(function(error) {
            promise.resolve( new de.Result.Error(error) );
        });
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Function
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {function(de.Context)} func
    @param {de.Options=} options
    @extends {de.Block}
*/
de.Block.Function = function(func, options) {
    this.func = func;
    this.setOptions(options);
};

node.util.inherits( de.Block.Function, de.Block );

/** @override */
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

/**
    @constructor
    @param {string} call
    @param {de.Options=} options
    @extends {de.Block}
*/
de.Block.Call = function(call, options) {
    this.setOptions(options);

    var r = call.match(/^(?:(.*?):)?(.*)\(\)$/);

    var module = r[1] || de.config.defaultModule;
    var method = this.method = r[2];

    module = de.modules[module];

    call = module[method];
    this.call = (typeof call === 'function') ? call : module;
};

node.util.inherits(de.Block.Call, de.Block);

/** @override */
de.Block.Call.prototype._run = function(promise, context) {
    this.call(promise, context, this.method);
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Include
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {string} filename
    @param {de.Options=} options
    @extends {de.Block}
*/
de.Block.Include = function(filename, options) {
    this.setOptions(options);

    this.filename = de.util.compileString(filename);
};

node.util.inherits(de.Block.Include, de.Block);

/**
    @type {!Object.<string, de.Block.Root>}
*/
de.Block.Include._cache = {};

/** @override */
de.Block.Include.prototype._run = function(promise, context) {
    var filename = de.util.resolveFilename( this.dirname, this.filename(context) );

    var block = de.Block.Include._cache[ filename ];
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
                var include = node.vm.runInNewContext( '(' + result + ')', de.sandbox, filename);

                var dirname = node.path.dirname(filename);

                var options = /** @type {de.Options} */ ( de.util.extend( {}, that.options, { dirname: dirname } ) ); // NOTE: Внешние скобки нужны, чтобы gcc применил type cast.
                var block = de.Block.Include._cache[ filename ] = new de.Block.Root(include, options);

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

no.events.bind('file-changed', function(e, filename) {
    /** @type {string} */ filename;

    delete de.Block.Include._cache[ filename ];
});

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Http
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {string} url
    @param {de.Options=} options
    @extends {de.Block}
*/
de.Block.Http = function(url, options) {
    this.setOptions(options);

    if (/(\?|&)$/.test(url)) {
        this.extend = true;
        url = url.substr(0, url.length - 1);
    }

    this.url = de.util.compileString(url);
};

node.util.inherits(de.Block.Http, de.Block);

/** @override */
de.Block.Http.prototype._run = function(promise, context) {
    var options = de.http.url2options(
        this.url(context),
        (this.extend) ? context['request'].query : null
    );

    de.http.get(options)
        .then(function(result) {
            promise.resolve( new de.Result.Raw(result, true) ); // FIXME: Учесть options.dataType.
        })
        .else_(function(error) {
            promise.resolve( new de.Result.Error(error) );
        });

};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Value
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {number|boolean|string|Object} value
    @param {de.Options=} options
    @extends {de.Block}
*/
de.Block.Value = function(value, options) {
    this.setOptions(options);
    this.value = value;
};

node.util.inherits(de.Block.Value, de.Block);

/** @override */
de.Block.Value.prototype._run = function(promise, params) {
    promise.resolve( new de.Result.Value(this.value) );
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Block.Root
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {(number|boolean|string|Object|Array|function(de.Context))} root
    @param {de.Options=} options
    @extends {de.Block}
*/
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

/** @override */
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

/**
    @param {(number|boolean|string|Object|Array|function(de.Context))} block
    @param {de.Options=} options
*/
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
                compiled = new de.Block.Object(/** @type {!Object} */ block, options);

            } else {
                compiled = block;

            }

            break;

        case 'function':

            /** @type {function(de.Context)} */ block;

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

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {*} result
*/
de.Result = function(result) {};

/**
    @return {string}
*/
de.Result.prototype.string = function() {};

/**
    @return {number|boolean|string|Object}
*/
de.Result.prototype.object = function() {};

/**
    @param {node.Stream} stream
*/
de.Result.prototype.write = function(stream) {};

/**
    @return {string}
*/
de.Result.prototype.formatted = function() {
    return JSON.stringify( this.object(), null, '    ' );
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @type {Object.<string, { timestamp: number, promise: no.Promise }>}
*/
de.Result._cache = {};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Raw
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {de.Result}
    @param {Array.<node.Buffer>} result
    @param {boolean|undefined} isJSON
*/
de.Result.Raw = function(result, isJSON) {
    this.result = result;
    this.isJSON = isJSON;
};

node.util.inherits( de.Result.Raw, de.Result );

/** @override */
de.Result.Raw.prototype.write = function(stream) {
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        stream.write( result[i] );
    }
};

/** @override */
de.Result.Raw.prototype.string = function() {
    var s = this._string;

    if (!s) {
        s = this._string = this.result.join('');
    }

    return s;
};

/** @override */
de.Result.Raw.prototype.object = function() {
    var o = this._object;

    if (!o) {
        o = this._object = (this.isJSON) ? JSON.parse( this.string() ) : this.string();
    }

    return o;
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Value
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {de.Result}
    @param {number|boolean|string|Object} result
*/
de.Result.Value = function(result) {
    this.result = result;
};

node.util.inherits( de.Result.Value, de.Result );

/** @override */
de.Result.Value.prototype.write = function(stream) {
    stream.write( this.string() );
};

/** @override */
de.Result.Value.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        s = this._string = JSON.stringify( this.result );
    }

    return s;
};

/** @override */
de.Result.Value.prototype.object = function() {
    return this.result;
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Error
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {de.Result.Value}
    @param {!Object} error
*/
de.Result.Error = function(error) {
    this.result = {
        'error': error
    };
};

node.util.inherits( de.Result.Error, de.Result.Value );

/**
    @param {string} field
    @return {*}
*/
de.Result.Error.prototype.get = function(field) {
    return this.result.error[field];
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Array
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {de.Result}
    @param {Array} result
*/
de.Result.Array = function(result) {
    this.result = result;
};

node.util.inherits( de.Result.Array, de.Result );

/** @override */
de.Result.Array.prototype.write = function(stream) {
    stream.write('[');
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        if (i) {
            stream.write(',');
        }
        result[i].write(stream);
    }
    stream.write(']');
};

/** @override */
de.Result.Array.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        var result = this.result;

        s = '[';
        for (var i = 0, l = result.length; i < l; i++) {
            if (i) {
                s += ',';
            }
            s += result[i].string();
        }
        s += ']';

        this._string = s;
    }

    return s;
};

/** @override */
de.Result.Array.prototype.object = function() {
    var o = this._object;

    if (!o) {
        var result = this.result;

        o = this._object = [];
        for (var i = 0, l = result.length; i < l; i++) {
            o[i] = result[i].object();
        }
    }

    return o;
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Result.Object
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {de.Result}
    @param {!Object} result
*/
de.Result.Object = function(result) {
    this.result = result;
};

node.util.inherits( de.Result.Object, de.Result );

/** @override */
de.Result.Object.prototype.write = function(stream) {
    stream.write('{');
    var i = 0;
    var result = this.result;
    for (var key in result) {
        if (i++) {
            stream.write(',');
        }
        stream.write( JSON.stringify(key) + ':' );
        result[key].write(stream);
    }
    stream.write('}');
};

/** @override */
de.Result.Object.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        var result = this.result;

        s = '{';
        var i = 0;
        for (var key in result) {
            if (i++) {
                s += ',';
            }
            s += JSON.stringify(key) + ':' + result[key].string();
        }
        s += '}';

        this._string = s;
    }

    return s;
};

/** @override */
de.Result.Object.prototype.object = function() {
    var o = this._object;

    if (!o) {
        var result = this.result;

        o = this._object = {};
        for (var key in result) {
            o[key] = result[key].object();
        }
    }

    return o;
};

// ----------------------------------------------------------------------------------------------------------------- //

// ----------------------------------------------------------------------------------------------------------------- //
// de.Context
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {nodeServerRequest} request
    @param {nodeServerResponse} response
    @param {Object=} config
*/
de.Context = function(request, response, config) {
    this['request'] = new de.Request(request);
    this['response'] = new de.Response(response);
    this['config'] = config || {};
    this['state'] = {};
    this.now = +new Date();
};

// ----------------------------------------------------------------------------------------------------------------- //
// de.Response
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {nodeServerResponse} response
*/
de.Response = function(response) {
    this._response = response;

    this.headers = {};
    this.cookies = {};
};

de.Response.prototype.setHeader = function(name, value) {
    this.headers[name] = value;
};

de.Response.prototype.setCookie = function(name, value) {
    this.cookies[name] = value;
};

de.Response.prototype.setStatus = function(status) {
    this.status = status;
};

de.Response.prototype.setRedirect = function(location) {
    this.location = location;
};

de.Response.prototype.end = function(result) {
    var response = this._response;

    var headers = this.headers;
    for (var header in headers) {
        response.setHeader(header, headers[header]);
    }

    var cookies = this.cookies;
    var cookie = [];
    for (var name in cookies) {
        cookie.push(name + '=' + cookies[name]);
    }
    response.setHeader('Set-Cookie', cookie); // FIXME: Выставлять expire и т.д.

    if (this.location) {
        response.statusCode = 302;
        response.setHeader('Location', this.location);
        response.end();
        return;
    }

    response.statusCode = this.status || 200;
    result.write(response);
    response.end();
};

// ----------------------------------------------------------------------------------------------------------------- //

// ----------------------------------------------------------------------------------------------------------------- //
// de.Request
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {nodeServerRequest} request
*/
de.Request = function(request) {
    this.headers = request.headers;
    this.cookies = de.util.parseCookies( this.headers['cookie'] || '' );

    var url = node.url.parse( request.url, true );

    this['query'] = url.query;
    this.path = url.pathname;
};

