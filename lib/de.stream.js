var no = require('nommon');
var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Stream = function(stream, callback) {
    this.stream = stream;
    this.callback = callback;

    this.buffering = true;
    this.finished = false;
    this.buffer = [];
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Stream.prototype.write = function(data) {
    if (!this.finished) {
        if (this.buffering) {
            this.buffer.push(data);
        } else {
            this.stream.write(data);
        }
    }
};

de.Stream.prototype.end = function() {
    this.finished = true;

    this.callback();
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Stream.prototype.pipe = function(stream) {
    var buffer = this.buffer;
    for (var i = 0, l = buffer.length; i < l; i++) {
        stream.write( buffer[i] );
    }
    this.buffering = false;
};

//  ---------------------------------------------------------------------------------------------------------------  //

