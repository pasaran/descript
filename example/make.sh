#!/bin/bash

cat ../deps/noscript/promise.js \
    ../src/de.js \
    ../src/util.js \
    ../src/file.js \
    ../src/http.js \
    ../src/block.js \
    ../src/result.js \
    ../src/context.js \
    ../src/response.js \
    ../src/request.js \
    modules/ya.js \
    config.js \
    descript.js > _descript.js

