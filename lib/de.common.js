//  ---------------------------------------------------------------------------------------------------------------  //
//  common
//  ---------------------------------------------------------------------------------------------------------------  //

var path_ = require('path');
var fs_ = require('fs');
var url_ = require('url');
var http_ = require('http');

//  ---------------------------------------------------------------------------------------------------------------  //

var no = require('nommon');

var de = require('./de.js');

//  ---------------------------------------------------------------------------------------------------------------  //

/*
de.resolveFilename = function(dirname, filename) {
    var root = ds.config['rootdir'];

    if (/^\//.test(filename)) {
        //  Absolute path.
        filename = path_.join(root, filename);
    } else {
        filename = path_.resolve(dirname, filename);
        //  FIXME: Проверить, что путь не вышел за пределы root'а.
    }

    return filename;
};
*/

// ----------------------------------------------------------------------------------------------------------------- //

/*
//  FIXME: Использовать тут no.jpath.
de.compileString = function(string) {
    var parts = string.split(/{\s*([^\s}]*)\s*}/g);

    var body = [];
    for (var i = 0, l = parts.length; i < l; i++) {
        var part = parts[i];

        if (i % 2) {
            var r = part.match(/^(state|config)\.(.*)$/);
            if (r) {
                //  TODO: Нужно уметь еще и { config.blackbox.url }.
                body.push('(' + r[1] + '["' + r[2] + '"] || "")');
            } else {
                body.push('( params["' + part + '"] || "")');
            }
        } else {
            body.push('"' + part + '"');
        }
    }

    return new Function('context', 'params', 'var state = context.state, config = context.config; return ' + body.join('+'));
};

de.compileJPath = function(string) {
    var parts = string.split(/\./g);

    var body = '';
    for (var i = 0, l = parts.length; i < l; i++) {
        var r = parts[i].match(/^(.+?)(\[\d+\])?$/);
        body += 'if (!r) return; r = r["' + r[1] + '"];';
        if (r[2]) {
            body += 'if (!r) return; r = r' + r[2] + ';';
        }
    }

    return new Function('r', body + 'return r;');
};
*/

//  ---------------------------------------------------------------------------------------------------------------  //

de.parseCookies = function(cookie) {
    var cookies = {};

    var parts = cookie.split(';');
    for (var i = 0, l = parts.length; i < l; i++) {
        var r = parts[i].match(/^\s*([^=]+)=(.*)$/);
        if (r) {
            cookies[ r[1] ] = r[2];
        }
    }

    return cookies;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.duration = function(s) {
    if (typeof s === 'number') {
        return s;
    }

    var parts = s.split(/(\d+)([dhms])/);
    var d = 0;

    for (var i = 0, l = parts.length; i < l; i += 3) {
        var n = +parts[i + 1];

        switch (parts[i + 2]) {
            case 'd':
                d += n * (60 * 60 * 24);
                break;
            case 'h':
                d += n * (60 * 60);
                break;
            case 'm':
                d += n * (60);
                break;
            case 's':
                d += n;
                break;
        }
    }

    return d * 1000;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.eval = function(js, namespace, sandbox) {
    if (namespace) {
        return Function( namespace, 'global', '"use strict"; return (' + js + ');' )(sandbox);
    } else {
        return Function( 'global', '"use strict"; return (' + js + ');' )();
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.error = function(error) {
    return new de.Result.Error(error);
};

de.resolve_error = function(error) {
    return ( new no.Promise() ).resolve( de.error(error) );
};

de.reject_error = function(error) {
    return ( new no.Promise() ).reject( de.error(error) );
};

