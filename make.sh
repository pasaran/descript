#!/bin/bash

cat noscript/delib-core.js \
    src/descript.js \
    src/util.js \
    src/block.js \
    src/result.js \
    src/context.js \
    src/response.js \
    src/request.js \
    > descript.js

