var no = require('nommon');

var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var fs_ = require('fs');

//  ---------------------------------------------------------------------------------------------------------------  //

de.file = {};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Кэш с уже считанными файлами (или файлы, которые в процессе чтения). В кэше хранятся promise'ы.
var _cacheGet = {};

//  Кэш считанных и выполненных файлов. В кэше хранятся promise'ы.
var _cacheLoad = {};

//  За какими файлами мы уже следим (чтобы не делать повторный watch).
var _watched = {};

//  ---------------------------------------------------------------------------------------------------------------  //

//  FIXME: Возможно, нужно сделать флаг dontWatch.
//  Или же не следить за файлом по-дефолту.
de.file.get = function(filename) {
    var promise = _cacheGet[filename];

    if (!promise) {
        promise = _cacheGet[filename] = new no.Promise();

        fs_.readFile(filename, function(error, content) {
            if (error) {
                //  Если не удалось считать файл, в следующий раз нужно повторить попытку,
                //  а не брать из кэша ошибку.
                _cacheGet[filename] = null;

                promise.reject({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                });
            } else {
                //  Содержимое файла закэшировано внутри promise'а. Следим, не изменился ли файл.
                de.file.watch('file-changed', filename);

                promise.resolve(content);
            }

        });
    }

    return promise;
};

no.events.on('file-changed', function(e, filename) {
    //  Файл изменился, выкидываем его из кэша.
    _cacheGet[filename] = null;
});

//  ---------------------------------------------------------------------------------------------------------------  //

de.file.load = function(filename) {
    var promise = _cacheLoad[filename];

    if (!promise) {
        promise = _cacheLoad[filename] = new no.Promise();

        de.file.get(filename)
            .then(function(content) {
                var result;

                try {
                    result = de.eval(content);
                } catch (e) {
                    promise.reject({
                        id: 'EVAL_ERROR',
                        message: e.message
                    });
                }

                de.file.watch('loaded-file-changed', filename);

                promise.resolve(result);
            })
            .else_(function(error) {
                _cacheLoad[filename] = null;

                promise.reject(error);
            });
    }

    return promise;
};

no.events.on('loaded-file-changed', function(e, filename) {
    //  Файл изменился, выкидываем его из кэша.
    _cacheLoad[filename] = null;
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

//  NOTE: Если сделать просто de.file.get() и не вызвать no.file.de.unwatch(),
//  то процесс не завершится никогда. Так как будет висеть слушатель изменений файла.
//
de.file.unwatch = function(type, filename) {
    if (filename) {
        fs_.unwatchFile(filename);

        var files = _watched[type];
        if (files) {
            //  FIXME: Или лучше удалять ключ совсем?
           files[filename] = false;
        }
    } else {
        if (type) {
            var files = _watched[type];

            for (var filename in files) {
                fs_.unwatchFile(filename);
            }

            _watched[type] = {};
        } else {
            for (type in _watched) {
                de.file.unwatch(type);
            }

            _watched = {};
        }
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

