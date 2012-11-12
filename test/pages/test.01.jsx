//  /test.01.jsx
//  /test.01.jsx?skip=yes

block({
    photo: file('json/photo.{ state.photo_id }.json', {
        before: {
            photo_id: 42
        },
        after: {
            album_id: '.album_id'
        },
        guard: '.skip != "yes"'
    }) +10,
    album: file('json/album.{ state.album_id }.json', {
        after: {
            album_data: '.data'
        }
    })
}, {
    result: {
        album: '.album',
        photo_data: '.photo.data',
        state: 'state'
    }
})
