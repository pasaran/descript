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

# java -jar /home/nop/bin/compiler.jar --js=_descript.js --compilation_level=ADVANCED_OPTIMIZATIONS --warning_level=VERBOSE --externs=externs.js > __descript.js


