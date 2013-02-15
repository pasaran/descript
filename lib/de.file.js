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
var _loaded = {};

//  Кэш со считанными и исполненными файлами.
var _evaled = {};

//  За какими файлами мы уже следим (чтобы не делать повторный watch).
var _watched = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.file.load = function(filename, datatype) {
    var promise = _loaded[filename];

    if (!promise) {
        promise = _loaded[filename] = new no.Promise();

        fs_.readFile(filename, function(error, content) {
            if (error) {
                //  Если не удалось считать файл, в следующий раз нужно повторить попытку,
                //  а не брать из кэша ошибку.
                _loaded[filename] = null;

                promise.reject( de.error({
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
                    }
                }

                promise.resolve( new de.Result.Raw(content, datatype) );
            }

        });
    }

    return promise;
};

no.events.on('file-changed', function(e, filename) {
    //  Файл изменился, выкидываем его из кэша.
    if ( _loaded[filename] ) {
        //  NOTE: Видимо, бессмысленно делать delete, т.к. предположительно
        //  файл будет запрошен снова и в кэше появится запись с этим же ключем.
        _loaded[filename] = null;
    }
});

//  ---------------------------------------------------------------------------------------------------------------  //

de.file.eval = function(filename) {
    var promise = _evaled[filename];

    if (!promise) {
        promise = _evaled[filename] = new no.Promise();

        fs_.readFile(filename, function(error, content) {
            if (error) {
                _evaled[filename] = null;

                promise.reject( de.error({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                }) );
            } else {
                var result;

                try {
                    result = de.eval(content);
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
    _evaled[filename] = null;
});
*/

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

