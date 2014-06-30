var no = require('nommon');

var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

var LEVELS = {
    off: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4
};

var LEVEL = LEVELS[ de.config.log.level ];
var LOGGER = de.config.log.logger;
var DATE_FORMAT = de.config.log.dateformat || '[%d.%m.%Y %H:%M:%S.%f]';

//  ---------------------------------------------------------------------------------------------------------------  //

var format_date = no.date.formatter(DATE_FORMAT);

de.log = function(level, msg) {
    if ( LEVELS[level] <= LEVEL ) {
        var timestamp = format_date( new Date() );

        LOGGER(level, timestamp + ' [' + level + '] ' + msg);
    }
}

//  ---------------------------------------------------------------------------------------------------------------  //

de.log.error = function(msg) {
    de.log('error', msg);
};

de.log.warn = function(msg) {
    de.log('warn', msg);
};

de.log.info = function(msg) {
    de.log('info', msg);
};

de.log.debug = function(msg) {
    de.log('debug', msg);
};

//  ---------------------------------------------------------------------------------------------------------------  //

