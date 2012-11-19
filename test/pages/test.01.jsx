//  /test.01.jsx
//  /test.01.jsx?skip=yes

de.block({
    /// photo: de.file('json/photo.{ config.id }.json', {
    photo: de.file('json/photo.{ state.photo_id }.json', {
        selectBefore: {
            photo_id: 42
        },
        selectAfter: {
            album_id: '.album_id'
        },
        guard: '.skip != "yes"'
    }) +10,
    album: de.file('json/album.{ state.album_id }.json', {
        selectAfter: {
            album_data: '.data'
        }
    })
}, {
    result: {
        album: '.album',
        photo_data: '.photo.data',
        state: 'state'
    }
    /*
    result: function(params, context) {
        return "hello";
    }
    */
})
