/**
    @constructor
    @param {node.Request} request
    @param {node.Response} response
    @param {Object=} config
*/
de.Context = function(request, response, config) {
    this.request = new de.Request(request);
    this.response = new de.Response(response);
    this.config = config || {};
    this.state = {};
    this.now = +new Date();
};

