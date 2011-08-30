// ----------------------------------------------------------------------------------------------------------------- //
// Response
// ----------------------------------------------------------------------------------------------------------------- //

var Response = function() {
    this.headers = {};
    this.cookies = {};
};

Response.prototype.setHeader = function(name, value) {
    this.headers[name] = value;
};

Response.prototype.setCookie = function(name, value) {
    this.cookies[name] = value;
};

Response.prototype.setStatus = function(status) {
    this.status = status;
};

Response.prototype.redirect = function(location) {
    this.location = location;
};

// ----------------------------------------------------------------------------------------------------------------- //

module.exports = Response;

// ----------------------------------------------------------------------------------------------------------------- //

