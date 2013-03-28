var no = require('nommon');
var de = require('./de.js');

require('./de.result.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var fs_ = require('fs');

//  ---------------------------------------------------------------------------------------------------------------  //

de.file = {};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Кэш с уже считанными файлами (или файлы, которые в процессе чтения).
//  В кэше хранятся promise'ы, в которых хранятся инстансы класса de.Result.File.
var _get_cache = {};

//  Кэш со считанными и исполненными файлами.
//  В кэше хранятся promise'ы, в которых хранится результат выполнения файлов.
var _eval_cache = {};

//  За какими файлами мы уже следим (чтобы не делать повторный watch).
var _watched = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.file.get = function(filename) {
    var promise = _get_cache[filename];

    if (!promise) {
        promise = _get_cache[filename] = new no.Promise();

        var rootdir = de.config.rootdir;
        //  Проверяем, что файл лежит внутри rootdir.
        var is_outside = ( filename.substr(0, rootdir.length) !== rootdir );
        if (is_outside) {
            return promise.reject( de.error({
                id: 'FILE_INVALID_PATH',
                message: 'Path \'' + filename + '\' is outside of rootdir'
            }) );
        }

        fs_.readFile(filename, function(error, buffer) {
            if (error) {
                //  Если не удалось считать файл, в следующий раз нужно повторить попытку,
                //  а не брать из кэша ошибку.
                _get_cache[filename] = null;

                //  FIXME: Разные коды ошибок в зависимости от.
                //  Как минимум 404.
                promise.reject( de.error({
                    id: 'FILE_OPEN_ERROR',
                    message: error.message
                }) );
            } else {
                //  Содержимое файла закэшировано внутри promise'а. Следим, не изменился ли файл.
                de.file.watch('file-changed', filename);

                promise.resolve( new de.Result.File(filename, buffer) );
            }
        });
    }

    return promise;
};

no.events.on('file-changed', function(e, filename) {
    //  Файл изменился, выкидываем его из кэша.
    _get_cache[filename] = null;
});

//  ---------------------------------------------------------------------------------------------------------------  //

//  Читаем файл и затем исполняем его.
//
//  Смысле второго и третьего параметра:
//
//      de.file.eval(filename, 'de', {
//          file: function() { ... },
//          http: function() { ... },
//          ...
//      });
//
//  В этом случае в файле можно будет использовать переменную de,
//  в частности, методы de.file, de.http, ...
//  Т.е. это некий аналог global.
//
de.file.eval = function(filename, namespace, sandbox) {
    var promise = _eval_cache[filename];

    if (!promise) {
        promise = _eval_cache[filename] = new no.Promise();

        //  FIXME: По идее, эти файлы не нужно кэшировать в _get_cache.
        de.file.get(filename)
            .done(function(/** @type {de.Result.File} */ result) {
                var evaled;

                try {
                    evaled = de.eval(result, namespace, sandbox);
                } catch (e) {
                    promise.reject( de.error({
                        id: 'EVAL_ERROR',
                        message: e.message
                    }) );
                }

                de.file.watch('loaded-file-changed', filename);

                promise.resolve(evaled);
            })
            .fail(function(error) {
                _eval_cache[filename] = null;

                promise.reject(error);
            });
    }

    return promise;
};

no.events.on('loaded-file-changed', function(e, filename) {
    //  Файл изменился, выкидываем его из кэша.
    _eval_cache[filename] = null;
});

//  ---------------------------------------------------------------------------------------------------------------  //

de.file.watch = function(type, filename) {
    var isWatched = ( _watched[type] || (( _watched[type] = {} )) )[filename];

    if (!isWatched) {
        _watched[type][filename] = true;

        //  FIXME: Непонятно, как это будет жить, когда файлов будет много.
        fs_.watchFile(filename, function (curr, prev) {
            if ( prev.mtime.getTime() !== curr.mtime.getTime() ) {
                no.events.trigger(type, filename);
            }
        });
    }
};

//  NOTE: Если сделать просто de.file.eval() и не вызвать no.file.de.unwatch(),
//  то процесс не завершится никогда. Так как будет висеть слушатель изменений файла.
//
de.file.unwatch = function(type, filename) {
    if (type) {
        var files = _watched[type];

        if (filename) {
            if ( files && files[filename] ) {
                fs_.unwatchFile(filename);

                delete files[filename];
            }
        } else {
            for (var filename in files) {
                fs_.unwatchFile(filename);
            }

            _watched[type] = {};
        }
    } else {
        for (type in _watched) {
            de.file.unwatch(type);
        }

        _watched = {};
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //
