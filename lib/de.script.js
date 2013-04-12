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
    var config_cmdline = prepareConfig(args, cwd);
    //  Параметры из файла с конфигом.
    var config_file;
    //  Параметры, переданные в de.script.init() в виде объекта.
    var config_arg;

    if (config_cmdline.config || typeof config === 'string') {
        //  Задано имя файла с конфигом.
        var config_filename = config_cmdline.config || config;
        config_file = prepareConfig(
            //  Читаем конфиг из файла.
            readConfig(config_filename),
            //  Относительные имена нужно резолвить от места,
            //  где лежит файл с конфигом.
            path_.dirname( path_.resolve(config_filename) )
        );
    } else {
        //  Объект с конфигом передан в de.script.init().
        config_arg = prepareConfig(config, cwd);
    }

    //  Склеиваем все три конфига вместе.
    //  (на самом деле, один из них всегда undefined).
    config = no.extend( {}, config_file, config_arg, config_cmdline );

    //  Если ни в одном конфиге не задан rootdir, то
    //  используем текущую директорию.
    config.rootdir = config.rootdir || cwd;

    de.config = config;

    return config;

    /**
        Резолвим относительные имена файлов, загружаем модули и т.д.

        @param {Object} config
        @param {string} basedir Директория, относительно которой нужно резолвить относительные пути файлов.
    */
    function prepareConfig(config, basedir) {
        if (!config) {
            return;
        }

        if (config.socket) {
            config.socket = path_.resolve(basedir, config.socket);
        }
        if (config.rootdir) {
            config.rootdir = path_.resolve(basedir, config.rootdir);
        }
        if (config.modules) {
            readModules(config.modules, basedir);
        }

        return config;
    }
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

