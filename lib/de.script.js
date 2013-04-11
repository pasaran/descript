//  ---------------------------------------------------------------------------------------------------------------  //
//  de.script
//  ---------------------------------------------------------------------------------------------------------------  //

var de = require('./de.js');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

var fs_ = require('fs');
var path_ = require('path');

var nopt = require('nopt');

//  ---------------------------------------------------------------------------------------------------------------  //

de.script = {};

//  ---------------------------------------------------------------------------------------------------------------  //

de._modules = {};

//  ---------------------------------------------------------------------------------------------------------------  //

//  В config можно передать имя файла или готовый объект с конфигом.
//  Или же не передать ничего, тогда будет использованы параметры
//  из командной строки.
//
de.script.init = function(config) {
    config = config || {};
    var options = {};

    if (typeof config == 'string') {
        options = {
            config: config
        };
    }

    var args = nopt(
        {
            port: String,
            socket: String,
            rootdir: String,
            config: String,
            help: Boolean,
            workers: Number
        }
    );

    options = no.extend( {}, options, args );

    var basedir;
    if (options.config) {
        config = readConfig(options.config);
        basedir = path_.dirname( path_.resolve(options.config) );
    }
    basedir = basedir || path_.resolve('.');

    config.port = options.port || config.port;
    config.socket = options.socket || config.socket;
    config.workers = options.workers || config.workers;

    if (config.socket) {
        config.socket = path_.resolve(basedir, config.socket);
    }
    config.rootdir = path_.resolve(basedir, options.rootdir || config.rootdir || '.');

    if (config.modules) {
        readModules(config.modules, basedir);
    }

    de.config = config;

    return config;
};

//  ---------------------------------------------------------------------------------------------------------------  //

function readConfig(filename) {
    var content = fs_.readFileSync(filename, 'utf-8');

    return de.eval(content);
};

//  ---------------------------------------------------------------------------------------------------------------  //

function readModules(modules, dirname) {
    for (var id in modules) {
        var filename = path_.join( dirname, modules[id] );

        de._modules[id] = require(filename);
    }
};

