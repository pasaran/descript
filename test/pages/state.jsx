de.object({
    func: de.func(function() {
            return {
                value1: 1,
                value2: 2,
                value3: 3
            };
        }, {
            state: function(data, context) {
                return {
                    function1: data.value1,
                    function2: data.value2,
                    function3: data.value3
                }
            }
        }
    ),
    jpath: de.func(function() {
            return {
                value1: {
                    value2: {
                        value3: 'jpath result'
                    }
                }
            };
        }, {
            state: '.value1.value2.value3'
        }
    ),
    jresult: de.func(function() {
            return {
                value1: 1,
                value2: 2,
                value3: 3
            };
        }, {
            state: {
                jresult1: ".value1",
                jresult2: ".value2",
                jresult3: ".value3"
            }
        }
    )
}, {
    result: function(data, context) {
        return {
            expected: {
                "function1":1,"function2":2,"function3":3,
                // nothing for jpath section
                "jresult1":1,"jresult2":2,"jresult3":3
            },
            result: context.state
        };
    }
})