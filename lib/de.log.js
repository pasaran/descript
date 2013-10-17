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

//  ---------------------------------------------------------------------------------------------------------------  //

var format_date = no.date.formatter('%d.%m.%Y %H:%M:%S');

function log(level, msg) {
    var timestamp = format_date( new Date() );

    if ( LEVELS[level] <= LEVEL ) {
        LOGGER(level, '[' + timestamp + '] [' + level + '] ' + msg);
    }
}

//  ---------------------------------------------------------------------------------------------------------------  //

de.log = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de.log.error = function(msg) {
    log('error', msg);
};

de.log.warn = function(msg) {
    log('warn', msg);
};

de.log.info = function(msg) {
    log('info', msg);
};

de.log.debug = function(msg) {
    log('debug', msg);
};

//  ---------------------------------------------------------------------------------------------------------------  //

