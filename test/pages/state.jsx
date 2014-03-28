de.object({
    func: de.func(function() {
            return {
                idUser: '213948712394',
                devices: {
                    desktop: {os: 'mac'}
                },
                emails: [
                    'user@yo.ru', 'user@yo.com'
                ]
            };
        }, {
            state: function(data, context) {
                return {
                    models: {
                        user: {
                            id: data.idUser,
                            emails: data.emails
                        },
                        devices: data.devices
                    }
                }
            }
        }
    ),
    jresult: de.func(function() {
            return {
                lang: 'ru',
                settings: {
                    view: 'tiles',
                    hasCamera: false,
                    hasPublished: true
                },
                accounts: [
                    'user@mail.ru', 'user@gmail.com'
                ]
            };
        }, {
            state: {
                models: {
                    user: {
                        language: '.lang',
                        emails: '.accounts'
                    },
                    settings: '.settings'
                }
            }
        }
    )
}, {
    result: function(data, context) {
        return context.state;
    }
})