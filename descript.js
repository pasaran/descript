// ------------------------------------------------------------------------------------------------------------- //
// no
// ------------------------------------------------------------------------------------------------------------- //

var no = {};

// ------------------------------------------------------------------------------------------------------------- //

no.inherits = function(child, parent) {
    var F = function() {};
    F.prototype = parent.prototype;
    child.prototype = new F();
    child.prototype.constructor = child;
};

// ------------------------------------------------------------------------------------------------------------- //

/**
    @param {!Object} dest
    @param {...!Object} srcs
    @return {!Object}
*/
no.extend = function(dest) {
    var srcs = [].slice.call(arguments, 1);

    for (var i = 0, l = srcs.length; i < l; i++) {
        var src = srcs[i];
        for (var key in src) {
            dest[key] = src[key];
        }
    }

    return dest;
};

// ------------------------------------------------------------------------------------------------------------- //

/**
    Пустая функция. No operation.
*/
no.pe = function() {};

// ------------------------------------------------------------------------------------------------------------- //

/**
    @param {string} className
    @param {Element} context
    @return {Array.<Element>}
*/
no.byClass = function(className, context) {
    context = context || document;
    return context.getElementsByClassName(className); // FIXME: Поддержка старых браузеров.
};

/**
    @param {Element} oldNode
    @param {Element} newNode
*/
no.replaceNode = function(oldNode, newNode) {
    oldNode.parentNode.replaceChild(newNode, oldNode);
};

// ------------------------------------------------------------------------------------------------------------- //
// no.array
// ------------------------------------------------------------------------------------------------------------- //

no.array = function(s) {
    return (s instanceof Array) ? s : [ s ];
};

/**
    @param {Array.<string>} array
    @return {Object.<string, boolean>}
*/
no.array.toObject = function(array) {
    var object = {};

    for (var i = 0, l = array.length; i < l; i++) {
        object[ array[i] ] = true;
    }

    return object;
};

/**
    @param {Array} array
    @param {function} filter
    @return {Array}
*/
no.array.grep = function(array, filter) {
    var r = [];

    for (var i = 0, l = array.length; i < l; i++) {
        var value = array[i];
        if (filter(value, i)) {
            r.push(value);
        }
    }

    return r;
};

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
// no.object
// ------------------------------------------------------------------------------------------------------------- //

no.object = {};

/**
    @param {!Object} obj
    @return {Array.<string>} Возвращает список всех ключей объекта.
*/
no.object.keys = function(obj) {
    var keys = [];

    for (var key in obj) {
        keys.push(key);
    }

    return keys;
};

/**
    @param {!Object} obj
    @return {boolean} Определяет, пустой ли объект или нет.
*/
no.object.isEmpty = function(obj) {
    for (var key in obj) {
        return false;
    }

    return true;
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
no.events._hid_key = '_hid';

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
            return ( handler[ no.events._hid_key ] === hid );
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
            return ( _handler._hid === hid );
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

    @param {string} name
    @param {*=} params
*/
no.events.trigger = function(name, params) {
    var handlers = no.events._get(name).slice(0); // Копируем список хэндлеров. Если вдруг внутри какого-то обработчика будет вызван unbind,
                                                  // то мы не потеряем вызов следующего обработчика.
    for (var i = 0, l = handlers.length; i < l; i++) {
        handlers[i](name, params);
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
    Проксируем resolve/reject в другой promise.

    @param {no.Promise}
    @return {no.Promise}
*/
no.Promise.prototype.pipe = function(promise) {
    this.then(function(result) {
        promise.resolve(result);
    });
    this.else_(function(error) {
        promise.reject(error);
    });

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

// ------------------------------------------------------------------------------------------------------------- //
// no.Future
// ------------------------------------------------------------------------------------------------------------- //

no.Future = function(worker) {
    this.worker = worker;
};

no.Future.prototype.run = function(params) {
    var promise = new no.Promise();

    this.worker(promise, params);

    return promise;
};

// ------------------------------------------------------------------------------------------------------------- //

no.Future.Wait = function(futures) {
    this.futures = futures;
};

no.Future.Wait.prototype.run = function(params) {
    var promises = [];

    var futures = this.futures;
    for (var i = 0, l = futures.length; i < l; i++) {
        promises.push( futures[i].run(params) );
    }

    return no.Promise.wait( promises );
};

no.Future.wait = function(futures) {
    return new no.Future.Wait(futures);
};

// ------------------------------------------------------------------------------------------------------------- //

no.Future.Seq = function(futures) {
    this.futures = futures;
};

no.Future.Seq.prototype.run = function(params) {
    var promise = new no.Promise;

    var futures = this.futures;
    var l = futures.length;

    var results = [];
    (function run(i, params) {
        if (i < l) {
            futures[i].run(params)
                .then(function(result) {
                    results[i] = result;
                    run(i + 1, result);
                })
                .else_(function(error) {
                    promise.reject(error);
                });
        } else {
            promise.resolve(results);
        }
    })(0, params);

    return promise;
};

no.Future.seq = function(futures) {
    return new no.Future.Seq(futures);
};

// ----------------------------------------------------------------------------------------------------------------- //

var de = {};

// ----------------------------------------------------------------------------------------------------------------- //

var node = {};

/** @type {nodeFs} */
node.fs = require('fs');

/** @type {nodeHttp} */
node.http = require('http');

/** @type {nodePath} */
node.path = require('path');

/** @type {nodeUrl} */
node.url = require('url');

/** @type {nodeUtil} */
node.util = require('util');

/** @type {nodeVm} */
node.vm = require('vm');

/** @type {nodeQueryString} */
node.querystring = require('querystring');

// ----------------------------------------------------------------------------------------------------------------- //
// de.file
// ----------------------------------------------------------------------------------------------------------------- //

de.file = {};

// ----------------------------------------------------------------------------------------------------------------- //

de.file._cache = {};

de.file.get = function(filename) {
    var promise = de.file._cache[filename];

    if (!promise) {
        promise = de.file._cache[filename] = new no.Promise();

        node.fs.readFile(filename, function(error, content) {
            if (error) {
                delete de.file._cache[filename]; // Если не удалось считать файл, в следующий раз нужно повторить попытку,
                                                 // а не брать из кэша ошибку.
                promise.reject({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                });
            } else {
                de.file.watch(filename); // Содержимое файла закэшировано внутри promise'а. Следим, не изменился ли файл.
                promise.resolve(content);
            }

        });
    }

    return promise;
};

no.events.bind('file-changed', function(e, filename) { // Файл изменился, выкидываем его из кэша.
    /** @type {string} */ filename;

    delete de.file._cache[ filename ];

    // FIXME: Не нужно ли тут делать еще и unwatch?
});

// ----------------------------------------------------------------------------------------------------------------- //

de.file._watched = {};

de.file.watch = function(filename) {
    if (!de.file._watched[ filename ]) { // FIXME: Непонятно, как это будет жить, когда файлов будет много.
        de.file._watched[ filename ] = true;

        node.fs.watchFile(filename, function (/** @type {{mtime: Date}} */ curr, /** @type {{mtime: Date}} */ prev) {
            if (prev.mtime !== curr.mtime) {
                no.events.trigger('file-changed', filename);
            }
        });
    }
};

de.file.unwatch = function(filename) {
    if (de.file._watched[ filename ]) {
        delete de.file._watched[ filename ];
        node.fs.unwatchFile(filename);
    }
};

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
        no.extend(query, params);
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

var ds = {};

ds.config = {};
ds.modules = {};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.util
// ----------------------------------------------------------------------------------------------------------------- //

ds.util = {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {!Object} dest
    @param {...!Object} srcs
    @return {!Object}
*/
ds.util.extend = function(dest, srcs) {
    for (var i = 1, l = arguments.length; i < l; i++) {
        var src = arguments[i];
        for (var key in src) {
            dest[key] = src[key];
        }
    }

    return dest;
};

// ----------------------------------------------------------------------------------------------------------------- //

ds.util.resolveFilename = function(dirname, filename) {
    var root = ds.config['rootdir'];

    if (/^\//.test(filename)) { // Absolute path.
        filename = node.path.join(root, filename);
    } else {
        filename = node.path.resolve(dirname, filename);
        // FIXME: Проверить, что путь не вышел за пределы root'а.
    }

    return filename;
};

// ----------------------------------------------------------------------------------------------------------------- //

ds.util.compileString = function(string) {
    var parts = string.split(/{\s*([^\s}]*)\s*}/g);

    var body = [];
    for (var i = 0, l = parts.length; i < l; i++) {
        var part = parts[i];

        if (i % 2) {
            var r = part.match(/^(state|config)\.(.*)$/);
            if (r) {
                body.push('(' + r[1] + '["' + r[2] + '"] || "")'); // TODO: Нужно уметь еще и { config.blackbox.url }.
            } else {
                body.push('( params["' + part + '"] || "")');
            }
        } else {
            body.push('"' + part + '"');
        }
    }

    return new Function('context', 'params', 'var state = context.state, config = context.config; return ' + body.join('+'));
};

ds.util.compileJPath = function(string) {
    var parts = string.split(/\./g);

    var body = '';
    for (var i = 0, l = parts.length; i < l; i++) {
        var r = parts[i].match(/^(.+?)(\[\d+\])?$/);
        body += 'if (!r) return; r = r["' + r[1] + '"];';
        if (r[2]) {
            body += 'if (!r) return; r = r' + r[2] + ';';
        }
    }

    return new Function('r', body + 'return r;');
};

// ----------------------------------------------------------------------------------------------------------------- //

ds.util.parseCookies = function(cookie) {
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

ds.util.duration = function(s) {
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

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {*} result
*/
ds.Result = function(result) {};

/**
    @return {string}
*/
ds.Result.prototype.string = function() {};

/**
    @return {number|boolean|string|Object}
*/
ds.Result.prototype.object = function() {};

/**
    @param {node.Stream} stream
*/
ds.Result.prototype.write = function(stream) {};

/**
    @return {string}
*/
ds.Result.prototype.formatted = function() {
    return JSON.stringify( this.object(), null, '    ' );
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @type {Object.<string, { timestamp: number, promise: no.Promise }>}
*/
ds.Result._cache = {};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result.Raw
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result}
    @param {Array.<node.Buffer>} result
    @param {boolean|undefined} isJSON
*/
ds.Result.Raw = function(result, isJSON) {
    this.result = result;
    this.isJSON = isJSON;
};

node.util.inherits( ds.Result.Raw, ds.Result );

/** @override */
ds.Result.Raw.prototype.write = function(stream) {
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        stream.write( result[i] );
    }
};

/** @override */
ds.Result.Raw.prototype.string = function() {
    var s = this._string;

    if (!s) {
        s = this._string = this.result.join('');
    }

    return s;
};

/** @override */
ds.Result.Raw.prototype.object = function() {
    var o = this._object;

    if (!o) {
        o = this._object = (this.isJSON) ? JSON.parse( this.string() ) : this.string();
    }

    return o;
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result.Value
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result}
    @param {number|boolean|string|Object} result
*/
ds.Result.Value = function(result) {
    this.result = result;
};

node.util.inherits( ds.Result.Value, ds.Result );

/** @override */
ds.Result.Value.prototype.write = function(stream) {
    stream.write( this.string() );
};

/** @override */
ds.Result.Value.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        s = this._string = JSON.stringify( this.result );
    }

    return s;
};

/** @override */
ds.Result.Value.prototype.object = function() {
    return this.result;
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result.Error
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result.Value}
    @param {!Object} error
*/
ds.Result.Error = function(error) {
    this.result = {
        'error': error
    };
};

node.util.inherits( ds.Result.Error, ds.Result.Value );

/**
    @param {string} field
    @return {*}
*/
ds.Result.Error.prototype.get = function(field) {
    return this.result.error[field];
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Result.Array
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result}
    @param {Array} result
*/
ds.Result.Array = function(result) {
    this.result = result;
};

node.util.inherits( ds.Result.Array, ds.Result );

/** @override */
ds.Result.Array.prototype.write = function(stream) {
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
ds.Result.Array.prototype.string = function() {
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
ds.Result.Array.prototype.object = function() {
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
// ds.Result.Object
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @extends {ds.Result}
    @param {!Object} result
*/
ds.Result.Object = function(result) {
    this.result = result;
};

node.util.inherits( ds.Result.Object, ds.Result );

/** @override */
ds.Result.Object.prototype.write = function(stream) {
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
ds.Result.Object.prototype.string = function() {
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
ds.Result.Object.prototype.object = function() {
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
// ds.Context
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {nodeServerRequest} request
    @param {nodeServerResponse} response
    @param {Object=} config
*/
ds.Context = function(request, response, config) {
    this['request'] = new ds.Request(request);
    this['response'] = new ds.Response(response);
    this['config'] = config || {};
    this['state'] = {};
    this.now = +new Date();
};

// ----------------------------------------------------------------------------------------------------------------- //
// ds.Response
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {nodeServerResponse} response
*/
ds.Response = function(response) {
    this._response = response;

    this.headers = {};
    this.cookies = {};
};

ds.Response.prototype.setHeader = function(name, value) {
    this.headers[name] = value;
};

ds.Response.prototype.setCookie = function(name, value) {
    this.cookies[name] = value;
};

ds.Response.prototype.setStatus = function(status) {
    this.status = status;
};

ds.Response.prototype.setRedirect = function(location) {
    this.location = location;
};

ds.Response.prototype.end = function(result) {
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
// ds.Request
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {nodeServerRequest} request
*/
ds.Request = function(request) {
    this.headers = request.headers;
    this.cookies = ds.util.parseCookies( this.headers['cookie'] || '' );

    var url = node.url.parse( request.url, true );

    this['query'] = url.query;
    this.path = url.pathname;
};

