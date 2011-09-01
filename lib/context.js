var Request = require('./request.js');
var Response = require('./response.js');

var Context = function(request, response, config) {
    this.request = new Request(request);
    this.response = new Response(response);
    this.config = config || {};
    var state = {};
};

module.exports = Context;

