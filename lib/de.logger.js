require('no.colors');

function logger(level, msg) {
    switch (level) {
        case 'info':
            console.log(msg.green);
            break;

        case 'debug':
            console.log(msg);
            break;

        case 'error':
            console.error(msg.red);
            break;

        case 'warn':
            console.error(msg.yellow);
            break;
    }
}

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = logger;

//  ---------------------------------------------------------------------------------------------------------------  //

