//  ---------------------------------------------------------------------------------------------------------------  //
//  de.script
//  ---------------------------------------------------------------------------------------------------------------  //

var de = require('./de.js');

require('./de.common.js');

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

//  Конфиг для работы descript'а составляется из трех частей:
//
//    * Конфиг из файла. Имя файла либо задано параметром --config,
//      либо передано в de.script.init().
//
//    * Объект, переданный в de.script.init().
//
//    * Параметры, переданные в командной строке.
//
de.script.init = function(config) {
    //  В случае, когда конфиг берется не из файла,
    //  относительные имена файлов в нем нужно резолвить
    //  относительно текущей директории.
    var cwd = path_.resolve('.');

    //  Читаем все параметры из командной строки.
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
    //  Удаляем лишние поля, генерируемые nopt'ом.
    delete args.argv;

    //  Параметры из командной строки.
    var config_cmdline = prepare_config(args, cwd);
    //  Параметры из файла с конфигом.
    var config_file;
    //  Параметры, переданные в de.script.init() в виде объекта.
    var config_arg;

    var basedir;

    if (config_cmdline.config || typeof config === 'string') {
        //  Задано имя файла с конфигом.
        var config_filename = config_cmdline.config || config;

        basedir = path_.dirname( path_.resolve(config_filename) );

        config_file = prepare_config(
            //  Читаем конфиг из файла.
            read_config(config_filename),
            //  Относительные имена нужно резолвить от места,
            //  где лежит файл с конфигом.
            basedir
        );
    }

    if (typeof config === 'object') {
        //  Объект с конфигом передан в de.script.init().
        basedir = basedir || cwd;

        config_arg = prepare_config(config, basedir);
    }

    //  Склеиваем все три конфига вместе.
    //  (на самом деле, один из них всегда undefined).
    config = no.extend( {}, config_file, config_arg, config_cmdline );

    config = default_config(config, basedir);

    //  Если ни в одном конфиге не задан rootdir, то
    //  используем текущую директорию.
    config.rootdir = config.rootdir || cwd;

    de.config = config;

    if (config.modules) {
        read_modules(config.modules, basedir);
    }

    require('./de.log.js');
    require('./de.sandbox.js');

    //  Делаем доступным config в .jsx-файлах.
    //  de.sandbox.config = config;

    return config;

};

//  ---------------------------------------------------------------------------------------------------------------  //

/**
    Резолвим относительные имена файлов, загружаем модули и т.д.

    @param {Object} config
    @param {string} basedir Директория, относительно которой нужно резолвить относительные пути файлов.
*/
function prepare_config(config, basedir) {
    if (!config) {
        return;
    }

    if (config.socket) {
        config.socket = path_.resolve(basedir, config.socket);
    }
    if (config.rootdir) {
        config.rootdir = path_.resolve(basedir, config.rootdir);
    }

    return config;
}

//  ---------------------------------------------------------------------------------------------------------------  //

function default_config(config, basedir) {
    if (!config) {
        return;
    }

    if (!config.log) {
        config.log = {};
    }
    if (!config.log.level) {
        config.log.level = 'debug';
    }
    if (!config.log.logger) {
        config.log.logger = './de.logger.js';
    } else {
        config.log.logger = path_.resolve(basedir, config.log.logger);
    }
    config.log.logger = require(config.log.logger);

    return config;
}

//  ---------------------------------------------------------------------------------------------------------------  //

function read_config(filename) {
    var content = fs_.readFileSync(filename, 'utf-8');

    return de.eval(content);
}

//  ---------------------------------------------------------------------------------------------------------------  //

function read_modules(modules, dirname) {
    for (var id in modules) {
        var filename = path_.join( dirname, modules[id] );

        de._modules[id] = require(filename);
    }
}
