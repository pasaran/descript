var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var fs_ = require('fs');
var path_ = require('path');

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

