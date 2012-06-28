function(context) {
    var response = context.response;

    response.setCookie('a', 42);
    response.setCookie('b', 77);

    return 'Cookies set'
}
