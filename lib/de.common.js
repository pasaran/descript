var de = require('./de.js');

var no = require('nommon');

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

//  ---------------------------------------------------------------------------------------------------------------  //

de.forward = function(src, dest) {
    src.pipe(dest);
    dest.forward('abort', src);
};

