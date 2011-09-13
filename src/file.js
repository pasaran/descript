// ----------------------------------------------------------------------------------------------------------------- //
// de.file
// ----------------------------------------------------------------------------------------------------------------- //

de.file = {};

// ----------------------------------------------------------------------------------------------------------------- //

de.file._readingCache = {};

de.file.get = function(filename) {
    var promise = de.file._readingCache[filename];

    if (!promise) {
        promise = de.file._readingCache[filename] = new no.Promise();

        node.fs.readFile(filename, function(error, content) {
            if (error) {
                promise.reject({
                    id: 'FILE_OPEN_ERROR',
                    message: error.message
                });
            } else {
                promise.resolve([ content ]);
            }
        });
    }

    return promise;
};

