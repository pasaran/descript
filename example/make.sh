#!/bin/bash

cd .. ; ./make.sh ; cd - >/dev/null

cat ../descript.js \
    modules/ya.js \
    config.js \
    example.js > _example.js

# java -jar /home/nop/bin/compiler.jar --js=_descript.js --compilation_level=ADVANCED_OPTIMIZATIONS --warning_level=VERBOSE --externs=externs.js > __descript.js


