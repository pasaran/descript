de.object(
    {
        foo: de.value(
            42,
            {
                after: function(params, context) {
                    context.state.foo = 42;
                }
            }
        ),
        bar: de.value(
            24,
            {
                after: function(params, context) {
                    context.state.bar = 24;
                }
            }
        )
    },
    {
        result: {
            result: '.',
            state: 'state'
        },
        local: true
    }
)

