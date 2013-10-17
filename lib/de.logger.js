function logger(level, msg) {
    switch (level) {
        case 'debug':
        case 'info':
            console.log('[' + level + ']', msg);
            break;

        case 'error':
        case 'warn':
            console.error('[' + level + ']', msg);
    }
}

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = logger;

//  ---------------------------------------------------------------------------------------------------------------  //

