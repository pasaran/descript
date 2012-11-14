/*

    Фейковый http-сервер для тестирования http-приложений.
    Управляется набором параметров в урле.

    Может возвращать заданную http-ошибку:

        /error=500

        /error=500&message=GOAWAY                    -- с заданным сообщением об ошибке.

        /error=500&delay=1000                        -- вернуть ошибку через секунду, а не сразу.

    Может вернуть содержимое заданного файла:

        /filename=foo.txt

        /filename=foo.txt&delay=1000                 -- вернуть весь файл через секунду.

        /filename=foo.txt&delay=1000x5               -- возвращать файл порциями, порций будет 5 штук, интервалы между ними будут в 1 секунду.

        /filename=foo.txt&delay=1000,2000,3000       -- тоже самое, но 3 порции, первая через секунду, вторая еще через 2, третья -- еще через 3.
                                                        т.е. весь запрос закончится через 6 секунд.

    Если имя файла не задано, то используется предопределенный контент.
    В формате json, txt или xml. Задается параметром datatype.

        /                                            -- возвращает дефолтный json (json -- это дефолтное значение параметра datatype).

        /delay=1000                                  -- тоже самое, но через секунду.

        /delay=1000&datatype=txt                     -- тоже самое, но возвращает текстовый контент.

        /delay=1000x5                                -- дефолтный json в 5 порций, между порциями задержка в 1 секунду.

        /delay=1000,2000,3000                        -- аналогично, но задержки между порциями заданы явно.


    Как использовать:

        var dummy = require('./dummy.js');

        var port = 2000;
        //  Запускает сервер на указанном порту.
        var server = dummy(port);

        //  И где-нибудь можно остановить сервер.
        server.close();


    Или же прямо из командной строки:

        node -e 'require("./dummy.js")();'

*/

//  ---------------------------------------------------------------------------------------------------------------  //

var fs_ = require('fs');
var http_ = require('http');
var url_ = require('url');
var path_ = require('path');

//  ---------------------------------------------------------------------------------------------------------------  //

var contentTypes = {
    json: 'application/json',
    xml: 'text/xml',
    txt: 'text/plain'
};

var fragments = {
    json: fs_.readFileSync( path_.resolve(__dirname, './chunk-json'), 'utf-8'),
    xml: fs_.readFileSync( path_.resolve(__dirname, './chunk-xml'), 'utf-8'),
    txt: fs_.readFileSync( path_.resolve(__dirname, './chunk-txt'), 'utf-8')
};

var infos = {
    json: {
        open: '[',
        delim: ',\n',
        close: ']'
    },
    xml: {
        open: '<items>',
        delim: '\n',
        close: '</items>'
    },
    txt: {
        open: '',
        delim: '\n\n',
        close: ''
    },
    file: {
        open: '',
        delim: '',
        close: ''
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = function(port) {

    return http_
        .createServer(function(req, res) {
            var params = url_.parse(req.url, true, true).query;

            var error = params.error;
            if (error) {
                var delay = params.delay || 0;

                setTimeout(function() {
                    res.writeHead( error, { 'Content-Type': 'text/plain' } );
                    res.end( params.message || http_.STATUS_CODES[error] || 'Unknown error' );
                }, delay);

                return;
            }

            var filename = params.filename;
            var datatype = getDatatype(filename, params.datatype);

            var delays = getDelays(params.delay);
            var l = delays.length;

            var chunks;
            var info;

            if (filename) {
                var content = fs_.readFileSync(filename, 'utf-8');
                chunks = splitString(content, l);
                info = infos['file'];
            } else {
                var fragment = fragments[datatype];
                chunks = [];
                for (var i = 0; i < l; i++) {
                    chunks.push(fragment);
                }
                info = infos[datatype];
            }

            res.writeHead(200, { 'Content-Type': contentTypes[datatype] });
            res.write(info.open);
            for (var i = 0; i < l; i++) {
                (function(i) {
                    setTimeout(function() {
                        if (i) {
                            res.write(info.delim);
                        }
                        res.write( chunks[i] );
                    }, delays[i]);
                })(i);
            }
            setTimeout(function() {
                res.end(info.close);
            }, delays[l - 1]);
        })
        .listen(port || 8000, '127.0.0.1');

};

//  ---------------------------------------------------------------------------------------------------------------  //

//  Разбиваем строку на n примерно равных кусков.
function splitString(s, n) {
    var p = Math.round(s.length / n);

    var chunks = [];
    for (var i = 0; i < n - 1; i++) {
        chunks.push( s.substr(i * p, p) );
    }
    chunks.push( s.substr( (n - 1) * p ) );

    return chunks;
}

//  ---------------------------------------------------------------------------------------------------------------  //

//  Вычисляем тип ответа. Либо по расширению имени файла (если передано),
//  либо по параметру datatype.
function getDatatype(filename, datatype) {
    if (!filename) {
        return datatype || 'json';
    }

    var ext = path_.extname(filename);

    switch (ext) {
        case '.json':
            return 'json';

        case '.xml':
            return 'xml';
    }

    return 'txt';
}

//  ---------------------------------------------------------------------------------------------------------------  //

function getDelays(delay) {
    if (delay) {
        var r;
        if (( r = /^(\d+)x(\d+)/.exec(delay) )) {
            //  Вариант, когда задержки заданы в виде: 1000x5.
            //  Т.е. 5 интервалов по 1 секунде каждый.
            var step = +r[1];
            var n = +r[2];

            delays = [];
            for (var i = 0; i < n; i++) {
                delays.push(step);
            }
        } else {
            //  Все задержки заданы явно, например: 1000,2000,3000.
            //  Т.е. первый чанк выдать через секунду, второй через 2 секунды после этого
            //  и третий еще через 3 секунды после второго.
            delays = delay
                .split(',')
                //  Приводим строки к числу.
                .map(function(x) {
                    return +x;
                });
        }
    } else {
        //  Дефолтное поведение: отдать все одним чанком без задержек.
        delays = [ 0 ];
    }

    //  Преобразуем относительные задержки в абсолютные (от начала запроса).
    //  Т.е. [ 1000, 2000, 3000 ] превратятся в [ 1000, 3000, 6000 ].
    for (var i = 1; i < delays.length; i++) {
        delays[i] += delays[i - 1];
    }

    return delays;
}

//  ---------------------------------------------------------------------------------------------------------------  //

