var no = require('nommon');
var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var de.Stream = function() {
    this._buffer = null;
    this._length = 0;
    this._streams = [];

    this._started = false;
    this._finished = false;
};

no.extend(de.Stream.prototype, no.Events);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Stream.prototype.data = function(data) {
    if (this._finished) {
        return;
    }

    if (this._started) {
        var buffer = this._buffer;
        var buffer_length = this._length;

        var data_length = data.length;

        var result_length = buffer_length + data_length;
        var result = new Buffer(result_length);

        buffer.copy(result, 0, 0, buffer_length);
        data.copy(result, buffer_length, 0, data_length);

        this._buffer = result;
        this._length = result_length;
    } else {
        this._buffer = data;
        this._length = data.length;

        this._started = true;
    }

    var streams = this._streams;
    for (var i = 0; i < streams.length; i++) {
        streams[i].write(data);
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Stream.prototype.end = function() {
    this.trigger('end');

    this._streams = null;
    this._finished = true;
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  TODO: Непонятно, как лучше.
//
//    * Можно генерить событие о том, что весь stream отдали в pipe.
//      Но тогда нужно всегда сперва делать .pipe(), а потом .on('end'):
//
//          stream.pipe(output);
//          stream.on('end', function() {
//              output.end();
//          });
//
//    * Другой вариант -- принимать вторым параметром callback.
//
de.Stream.prototype.pipe = function(stream) {
    if (this._started) {
        stream.write(this._buffer);
    }

    if (!this._finished) {
        this._streams.push(stream);
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

