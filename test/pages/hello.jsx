de.object({
    username: 'nop',
    data: {
        foo: {
            bar: [ 1, 2, 3 ]
        }
    },
    a: 42,
    b: 24
}, {
    /*
    result: {
        foo: '.data.foo',
        bar: '.data.foo.bar[1]',
        sum: '.a * .b'
    },
    guard: '.foo'
    */
    template: './template.js'
})
