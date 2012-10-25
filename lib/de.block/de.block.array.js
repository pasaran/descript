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

    this.groups = this._groupItems(items);
};

no.inherit(de.Block.Array, de.Block);

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array.prototype._groupItems = function(items) {
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

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array.prototype._run = function(promise, context, params) {
    var that = this;

    var results = [];
    var groups = this.groups;

    var i = 0;
    var l = groups.length;

    (function run() {
        if (i < l) {
            var promises = [];

            var group = groups[i++];
            for (var j = 0, m = group.length; j < m; j++) {
                (function(item) {
                    var promise = item.block.run(params, context).then(function(r) {
                        results[item.index] = r;
                    });
                    promises.push(promise);
                })( group[j] );
            }

            no.Promise.wait(promises).then(run);

        } else {
            promise.resolve( that.root._getResult(results) );
        }
    })();
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Block.Array.prototype._getResult = function(results) {
    return new de.Result.Array(results);
};

