function logger(level, msg) {
    switch (level) {
        case 'debug':
        case 'info':
            console.log(msg);
            break;

        case 'error':
        case 'warn':
            console.error(msg);
    }
}

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = logger;

//  ---------------------------------------------------------------------------------------------------------------  //

