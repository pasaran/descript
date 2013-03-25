var no = require('nommon');

var de = require('./de.js');

require('./de.result.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var fs_ = require('fs');
var path_ = require('path');

//  ---------------------------------------------------------------------------------------------------------------  //

de.file = {};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Кэш с уже считанными файлами (или файлы, которые в процессе чтения).
//  В кэше хранятся promise'ы. Внутри promise'ом лежит инстансы класса CacheItem.
var _get_cache = {};

//  Кэш со считанными и исполненными файлами.
var _eval_cache = {};

//  За какими файлами мы уже следим (чтобы не делать повторный watch).
var _watched = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.file.get = function(filename) {
    var promise = _get_cache[filename];

    if (!promise) {
        promise = _get_cache[filename] = new no.Promise();

        //  Проверяем, что файл лежит внутри rootdir.
        var rootdir = de.config.rootdir;
        var outside = ( filename.substr(0, rootdir.length) !== rootdir );
        if (outside) {
            return promise.reject( de.error({
                id: 'FILE_INVALID_PATH',
                message: 'Path \'' + filename + '\' is outside of rootdir'
            }) );
        }

        fs_.readFile(filename, function(error, content) {
            if (error) {
                //  Если не удалось считать файл, в следующий раз нужно повторить попытку,
                //  а не брать из кэша ошибку.
                _get_cache[filename] = null;

                //  FIXME: Разные коды ошибок в зависимости от.
                //  Как минимум 404.
                promise.reject( de.error({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                }) );
            } else {
                //  Содержимое файла закэшировано внутри promise'а. Следим, не изменился ли файл.
                de.file.watch('file-changed', filename);

                promise.resolve( new CacheItem(filename, content) );
            }
        });
    }

    return promise;
};

no.events.on('file-changed', function(e, filename) {
    //  Файл изменился, выкидываем его из кэша.
    //  FIXME: Зачем тут эта проверка? Мы следим только за тем, что лежит в кэше вроде?
    if ( _get_cache[filename] ) {
        //  FIXME: Видимо, бессмысленно делать delete, т.к. предположительно
        //  файл будет запрошен снова и в кэше появится запись с этим же ключем.
        _get_cache[filename] = null;
    }
});

//  ---------------------------------------------------------------------------------------------------------------  //

de.file.eval = function(filename, namespace, sandbox) {
    var promise = _eval_cache[filename];

    if (!promise) {
        promise = _eval_cache[filename] = new no.Promise();

        de.file.get(filename)
            .then(function(/** @type {CacheItem} */ content) {
                var result;

                //  FIXME: Может try/catch должен быть внутри de.eval?
                try {
                    result = de.eval(content, namespace, sandbox);
                } catch (e) {
                    promise.reject( de.error({
                        id: 'EVAL_ERROR',
                        message: e.message
                    }) );
                }

                de.file.watch('loaded-file-changed', filename);

                promise.resolve(result);
            })
            .else_(function(error) {
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

function CacheItem(filename, buffer) {
    this.filename = filename;
    this.buffer = buffer;
}

CacheItem.prototype.datatype = function() {
    var ext = path_.extname(this.filename);

    switch (ext) {
        case '.json':
            return 'json';

        case '.html':
            return 'html';

        case '.txt':
        case '.xml':
        case '.js':
        case '.css':
            return 'text';
    }

    return 'binary';
};

CacheItem.prototype.toResult = function(datatype, outputtype) {
    return new de.Result.Raw( this.buffer, datatype || this.datatype(), outputtype )
};

CacheItem.prototype.toString = function() {
    return this.buffer.toString();
};

//  ---------------------------------------------------------------------------------------------------------------  //

