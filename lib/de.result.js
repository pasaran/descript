var no = require('nommon');
var de = require('./de.js');

var path_ = require('path');


//  ---------------------------------------------------------------------------------------------------------------  //
//  Consts
//  ---------------------------------------------------------------------------------------------------------------  //

//  Преобразования между расширениями файлов, content-type и data-type.

var content_type_by_ext = {
    '.json': 'application/json',

    '.html': 'text/html',
    '.htm': 'text/html',

    '.text': 'text/plain',
    '.txt': 'text/plain',

    '.css': 'text/css',
    '.js': 'application/javascript',

    '.xml': 'text/xml',

    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif'
};

var data_type_by_content_type = {
    'text/json': 'json',
    'application/json': 'json',

    'text/html': 'html',

    'text/plain': 'text',
    'text/xml': 'text',
    'application/xml': 'text',
    'text/css': 'text',
    'text/javascript': 'text',
    'text/x-javascript': 'text',
    'application/javascript': 'text',
    'application/x-javascript': 'text'
};

var content_type_by_data_type = {
    'text': 'text/plain',
    'html': 'text/html',
    'json': 'application/json'
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  В классах de.Result.* хранятся результаты выполнения блоков.
//
//  de.Result --- базовый абстрактный класс, от него наследуются все остальные
//  (главным образом, для того, чтобы делать instanceof de.Result).
//
//  de.Result.File и de.Result.Http возвращаются из de.file и de.http соответственно.
//  Сами по себе не используются для вывода, из них всегда создается de.Result.Raw.
//  Смысл этого преобразования в том, что при создании de.Result.Raw можно переопределить
//  флаги data_type и output_type. Это позволяет кэшировать de.Result.File/Http
//  (с тем data_type, который определяется самим контентом) и при выводе менять data_type.
//
//  de.Result.Value --- для константных значений (числа, строки, объекты, ...).
//
//  de.Result.Error --- для ошибок.
//
//  de.Result.Array и de.Result.Object --- композитные объекты, для массивов и объектов соответственно.
//
//  Все эти классы должны (как минимум) определить методы:
//
//    * string() --- строковое представление объекта
//    * object() --- объект, с которым можно работать в js.
//    * write() --- записать объект в поток.
//

//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result = function(result) {};

de.Result.prototype.data_type = 'json';
de.Result.prototype.content_type = 'application/json';

de.Result.prototype.string = function() {};

de.Result.prototype.object = function() {};

de.Result.prototype.write = function(stream) {};

de.Result.prototype.formatted = function() {
    return JSON.stringify( this.object(), null, 4 );
};

de.Result.prototype.select = function(jpath, vars) {
    return no.jpath( jpath, this.object(), vars );
};

de.Result.prototype.contentType = function() {
    var content_type = this.content_type;

    if (this.data_type !== 'binary') {
        content_type += '; charset=utf-8';
    }

    return content_type;
};

//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result.Value
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Value = function(result) {
    this.result = result;
};

no.inherit(de.Result.Value, de.Result);

de.Result.Value.prototype._id = 'value';

de.Result.Value.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        s = this._string = JSON.stringify(this.result);
    }

    return s;
};

de.Result.Value.prototype.object = function() {
    return this.result;
};

de.Result.Value.prototype.write = function(stream) {
    stream.write( this.string() );
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result.Raw
//  ---------------------------------------------------------------------------------------------------------------  //

//  У блока de.Result.Raw есть два флага: data_type и output_type.
//  Первый определяется тем, какой контент на самом деле в этом блоке.
//  Например:
//
//      "hello.txt"
//
//  data_type === 'text'.
//
//  Но, вот здесь:
//
//      {
//          hello: "hello.txt"
//      }
//
//  file-блок нужно выводить не как текстовый файл, но как строку,
//  т.е. output_type === 'json' (и по-прежнему data_type === 'text').
//
//  data_type может принимать одно из значений: 'json', 'text', 'html', 'binary',
//  а output_type в данный момент может быть 'json' или undefined.

de.Result.Raw = function(result, data_type, output_type) {
    /** @type {Buffer} */
    this.result = result.buffer;

    if (data_type) {
        //  data_type задан явно в options.
        this.data_type = data_type;
        this.content_type = content_type_by_data_type[data_type];
    } else {
        //  Используем data_type и content_type из result'а.
        this.data_type = result.data_type;
        this.content_type = result.content_type;
    }

    //  output_type задан явно в options.
    if (output_type) {
        this.output_type = output_type;
        this.content_type = content_type_by_data_type[output_type];
    }
};

no.inherit(de.Result.Raw, de.Result);

de.Result.Raw.prototype._id = 'raw';

de.Result.Raw.prototype.string = function() {
    var s = this._string;

    if (s === undefined) {
        s = this._string = (this.data_type === 'json') ? this.result.toString() : JSON.stringify( this.result.toString() );
    }

    return s;
};

de.Result.Raw.prototype.object = function() {
    var o = this._object;

    if (o === undefined) {
        o = this._object = (this.data_type === 'json') ? JSON.parse( this.string() ) : this.string();
    }

    return o;
};

//  Значением output_type может быть либо 'json', либо undefined.
//
de.Result.Raw.prototype.write = function(stream, output_type) {
    output_type = output_type || this.output_type;

    if (this.data_type === 'json' || output_type !== 'json') {
        //  Либо это у нас изначально json,
        //  либо это text или html, который не внутри объекта/массива
        //  и для которого не задан явно output_type.
        //
        //  Выводим результат как есть.
        //
        stream.write(this.result);
    } else {
        //  Преобразуем текстовый контент в строку (JSON.stringify).
        stream.write( this.string() );
    }

    //  FIXME: binary не может быть внутри объекта/массива.
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result.Array
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Array = function(result) {
    this.result = result;
};

no.inherit(de.Result.Array, de.Result);

de.Result.Array.prototype._id = 'array';

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

de.Result.Array.prototype.object = function() {
    var o = this._object;

    if (!o) {
        var result = this.result;

        o = this._object = [];
        for (var i = 0, l = result.length; i < l; i++) {
            o.push( result[i].object() );
        }
    }

    return o;
};

de.Result.Array.prototype.write = function(stream) {
    stream.write('[');
    var result = this.result;
    for (var i = 0, l = result.length; i < l; i++) {
        if (i) {
            stream.write(',');
        }
        result[i].write(stream, 'json');
    }
    stream.write(']');
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result.Object
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Object = function(result) {
    this.result = result;
};

no.inherit(de.Result.Object, de.Result);

de.Result.Object.prototype._id = 'object';

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

de.Result.Object.prototype.write = function(stream) {
    stream.write('{');
    var i = 0;
    var result = this.result;
    for (var key in result) {
        if (i++) {
            stream.write(',');
        }
        stream.write( JSON.stringify(key) + ':' );
        result[key].write(stream, 'json');
    }
    stream.write('}');
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.HTML = function(result) {
    this.result = result;
};

no.inherit(de.Result.HTML, de.Result.Value);

de.Result.HTML.prototype._id = 'html';

de.Result.HTML.prototype.data_type = 'html';
de.Result.HTML.prototype.content_type = 'text/html';

de.Result.HTML.prototype.write = function(stream) {
    stream.write(this.result);
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result.Error
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Error = function(error) {
    this.result = {
        'error': error
    };
};

no.inherit(de.Result.Error, de.Result.Value);

de.Result.Error.prototype._id = 'error';

de.Result.Error.prototype.get = function(field) {
    return this.result.error[field];
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result.File
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.File = function(filename, buffer) {
    this.buffer = buffer;

    var ext = path_.extname(filename);

    this.content_type = content_type_by_ext[ext] || 'application/octet-stream';
    this.data_type = data_type_by_content_type[this.content_type] || 'binary';
};

de.Result.File.prototype._id = 'file';

de.Result.File.prototype.toString = function() {
    return this.buffer.toString();
};


//  ---------------------------------------------------------------------------------------------------------------  //
//  de.Result.Http
//  ---------------------------------------------------------------------------------------------------------------  //

de.Result.Http = function(headers) {
    //  Здесь будет итоговый буфер с данными (после события 'end').
    this.buffer = null;

    this.content_type = de.mime(headers) || 'application/octet-stream';
    this.data_type = data_type_by_content_type[this.content_type] || 'binary';

    //  Сохраняем все буфера, приходящие в событие 'data'.
    this._buffers = [];
    //  И считаем их суммарную длину.
    this._length = 0;
};

de.Result.Http.prototype._id = 'http';

de.Result.Http.prototype.data = function(data) {
    this._buffers.push(data);
    this._length += data.length;
};

de.Result.Http.prototype.end = function() {
    this.buffer = Buffer.concat(this._buffers, this._length);

    this._buffers = null;
};


//  ---------------------------------------------------------------------------------------------------------------  //

/*
de.result = function(data) {
    if (data && typeof data === 'object') {
        if ( Array.isArray(data) ) {
            return new de.Result.Array(data);
        } else {
            return new de.Result.Object(data);
        }
    }

    return new de.Result.Value(data);
};
*/

//  ---------------------------------------------------------------------------------------------------------------  //

