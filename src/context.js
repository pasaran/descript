// ----------------------------------------------------------------------------------------------------------------- //
// ds.Context
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {nodeServerRequest} request
    @param {nodeServerResponse} response
    @param {Object=} config
*/
ds.Context = function(request, response, config) {
    this['request'] = new ds.Request(request);
    this['response'] = new ds.Response(response);
    this['config'] = config || {};
    this['state'] = {};
    this.now = +new Date();
};

