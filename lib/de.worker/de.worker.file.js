var de = require('../de.js');

require('../de.result');
require('./de.worker.js');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var fs_ = require('fs');

//  ---------------------------------------------------------------------------------------------------------------  //

//  Кэш с уже считанными файлами (или файлы, которые в процессе чтения). В кэше хранятся promise'ы.
var _cache = {};

//  За какими файлами мы уже следим (чтобы не делать повторный watch).
var _watched = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Worker.File = function(filename, datatype) {
    var promise = this.promise = new no.Promise();

    var result = _cache[filename];
    if (result) {
        //  FIXME: Если вдруг будет два запроса к однму файлу, но с разным datatype,
        //  то выйдет не очень хорошо.
        promise.resolve(result);
    } else {
        fs_.readFile(filename, function(error, content) {
            if (error) {
                //  Если не удалось считать файл, в следующий раз нужно повторить попытку,
                //  а не брать из кэша ошибку.
                _cache[filename] = null;

                promise.reject( new de.Result.Error({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                }) );
            } else {
                //  Содержимое файла закэшировано внутри promise'а. Следим, не изменился ли файл.
                watchFile(filename);
                promise.resolve( new de.Result.Raw( [ content ], datatype ) );
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

