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
//  В кэше хранятся promise'ы.
var _get_cache = {};

//  Кэш со считанными и исполненными файлами.
var _eval_cache = {};

//  За какими файлами мы уже следим (чтобы не делать повторный watch).
var _watched = {};

//  ---------------------------------------------------------------------------------------------------------------  //

function checkFilename(filename) {
    var rel = path_.relative(de.config.rootdir, filename);

    if ( /^\.\./.test(rel) ) {
        return de.error({
            id: 'FILE_INVALID_PATH',
            message: 'Path \'' + filename + '\' is outside of rootdir'
        });
    }
}

de.file.get = function(filename, datatype, outputtype) {
    var error = checkFilename(filename);
    if (error) {
        return no.Promise.resolve(error);
    }

    var promise = _get_cache[filename];

    if (!promise) {
        promise = _get_cache[filename] = new no.Promise();

        fs_.readFile(filename, function(error, content) {
            if (error) {
                //  Если не удалось считать файл, в следующий раз нужно повторить попытку,
                //  а не брать из кэша ошибку.
                _get_cache[filename] = null;

                //  FIXME: Разные коды ошибок в зависимости от.
                //  Как минимум 404.
                promise.resolve( de.error({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                }) );
            } else {
                //  Содержимое файла закэшировано внутри promise'а. Следим, не изменился ли файл.
                de.file.watch('file-changed', filename);

                if (!datatype) {
                    var ext = path_.extname(filename);

                    switch (ext) {
                        case '.json':
                            datatype = 'json';
                            break;

                        case '.html':
                            datatype = 'html';
                            break;

                        case '.txt':
                        case '.xml':
                            datatype = 'text';
                            break;

                        default:
                            //  FIXME: Прямо сейчас, сюда попасть невозможно,
                            //  т.к. у file-блока может быть только "текстовый" контент.
                            datatype = 'binary';
                    }
                }

                promise.resolve( new de.Result.Raw(content, datatype, outputtype) );
            }

        });
    }

    return promise;
};

no.events.on('file-changed', function(e, filename) {
    //  Файл изменился, выкидываем его из кэша.
    if ( _get_cache[filename] ) {
        //  NOTE: Видимо, бессмысленно делать delete, т.к. предположительно
        //  файл будет запрошен снова и в кэше появится запись с этим же ключем.
        _get_cache[filename] = null;
    }
});

//  ---------------------------------------------------------------------------------------------------------------  //

de.file.eval = function(filename, namespace, sandbox) {
    var error = checkFilename(filename);
    if (error) {
        return no.Promise.reject(error);
    }

    var promise = _eval_cache[filename];

    if (!promise) {
        promise = _eval_cache[filename] = new no.Promise();

        fs_.readFile(filename, function(error, content) {
            if (error) {
                _eval_cache[filename] = null;

                promise.reject( de.error({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                }) );
            } else {
                var result;

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
            }
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

