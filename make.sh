#!/bin/bash

cat noscript/src/no/no.js \
    noscript/src/no/no.array.js \
    noscript/src/no/no.object.js \
    noscript/src/no/no.events.js \
    noscript/src/no/no.promise.js \
    noscript/src/no/no.future.js \
    noscript/src/no/no.path.js \
    \
    noscript/src/de/de.js \
    noscript/src/de/de.file.js \
    noscript/src/de/de.http.js \
    \
    src/descript.js \
    src/util.js \
    src/block.js \
    src/result.js \
    src/context.js \
    src/response.js \
    src/request.js \
    \
    > descript.js

