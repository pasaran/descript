var de = require('../de.js');

require('./de.block.js');
require('../de.result');

var no = require('nommon');

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array = function(array, descript, options) {
    this._init(descript, options);

    var items = [];
    for (var i = 0, l = array.length; i < l; i++) {
        items.push({
            index: i,
            block: de.Block.compile(array[i], descript, options)
        });
    }

    this.groups = groupItems(items);

    function groupItems(items) {
        var l = items.length;
        if (!l) {
            return [ [] ];
        }

        var sorted = items.sort(function(a, b) { return b.block.priority - a.block.priority; });

        var groups = [];
        var group = [];

        var i = 0;
        var item = sorted[0];
        var next;
        while (i < l) {
            group.push(item);

            i++;
            if (i < l) {
                next = sorted[i];
                if (item.block.priority !== next.block.priority) {
                    groups.push(group);
                    group = [];
                }
            } else {
                groups.push(group);
                break;
            }

            item = next;
        }

        return groups;
    };

};

no.inherit(de.Block.Array, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array.prototype._run = function(promise, params, context) {
    var that = this;

    var results = [];
    var groups = this.groups;

    var i = 0;
    var l = groups.length;

    var workers;
    var promises;
    var wait;

    promise.on('abort', function() {
        if (workers) {
            wait.reject();

            for (var j = 0, m = workers.length; j < m; j++) {
                workers[j].trigger('abort');
            }

            //  FIXME: Что тут нужно вернуть-то?
            promise.resolve(null);

            i = l;
        }
    });

    (function run() {
        if (i < l) {
            promises = [];
            workers = [];

            var group = groups[i];
            for (var j = 0, m = group.length; j < m; j++) {
                (function(item) {
                    var worker = item.block.run(params, context)
                        .then(function(r) {
                            results[item.index] = r;
                        });

                    workers.push(worker);
                    promises.push(worker.promise);
                })( group[j] );
            }

            i++;

            wait = no.Promise.wait(promises).then(run);

        } else {
            //  FIXME: Нужно ли это вообще?
            worker.off('abort');

            worker.promise.resolve( that.root._getResult(results) );
        }
    })();

    return worker;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array.prototype._getResult = function(results) {
    return new de.Result.Array(results);
};

