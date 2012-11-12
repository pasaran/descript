//  /test.01.jsx?photo_id=42
block({
    photo: file('json/photo.{ .photo_id }.json', {
        after: {
            album_id: '.album_id'
        },
        guard: '.photo_id == 42'
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
