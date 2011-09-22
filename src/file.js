// ----------------------------------------------------------------------------------------------------------------- //
// de.file
// ----------------------------------------------------------------------------------------------------------------- //

de.file = {};

// ----------------------------------------------------------------------------------------------------------------- //

de.file._cache = {};

de.file.get = function(filename) {
    var promise = de.file._cache[filename];

    if (!promise) {
        promise = de.file._cache[filename] = new no.Promise();

        node.fs.readFile(filename, function(error, content) {
            if (error) {
                promise.reject({
                    'id': 'FILE_OPEN_ERROR',
                    'message': error.message
                });
            } else {
                promise.resolve(content);
            }
        });
    }

    return promise;
};

