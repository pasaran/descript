ChangeLog
=========

0.0.32
------

  * Ключик `--cpus` переименован в `--workers`.
    Вместо `--cpus 2` нужно использовать `--workers 1`.
    Дефолтное значение параметра `--workers` — `require('os').cpus().length - 1`.

  * Изменена сигнатура в `options.after` на `(params, context, result)`.
    При этом `result` это инстанс класса `de.Result.*`, а не готовый объект с данными.
    Если нужен доступ к какому-то его содержимому нужно использовать метод `object()`:

        after: function(params, context, result) {
            var o = result.object();

            console.log(o.foo.bar);
        }

  * Поправлено JS API. Минимально работающий вариант:

        var de = require('descript');

        de.script.init();

        de.Block.compile('http://yandex.ru/yandsearch?')
            .run({ text: 'descript' })
                .then(function(result) {
                    console.log( result.string() );
                });

    В этом примере контекст создается автоматически (при этом и доступа к нему нет).
    В `result` находится инстанс `de.Result`.

    Более сложный вариант:

        var http = require('http');
        var de = require('descript');

        de.script.init();

        var block = de.Block.compile('http://yandex.ru/yandsearch?');

        http
            .createServer(function(req, res) {
                //  Создаем (асинхронно) контекст.
                de.Context.create(req).done(function(context) {
                    block
                        .run({ text: 'descript' })
                            .then(function(result) {
                                //  Этот метод выставляет все заголовки и т.д.,
                                //  а также выводит результат в выходной поток (res) и закрывает поток.
                                context.response.end(res, result);
                            });
                });
            })
            .listen(2000);

    Альтернативный вариант — использовать `de.server.start()` для поднятия сервера автоматически:

        var de = require('descript');

        de.server.init();
        de.server.start();


  * Изменения в `de.Context`:

      * Конструктор `de.Context()` первым параметром принимает или нодовский реквест (`http.IncomingMessage`),
        или просто объект с параметрами.

      * Инстанс `de.Context` содержит поля:

          * `request` — может быть null, если в конструктор были переданы просто параметры.
            Либо инстанс `de.Request`.

          * `response` — инстанс `de.Response`.

          * `query` — все параметры (включая извлеченные из body запроса при `post`-запросе).

          * `state` — общий стейт для обмена информацией между блоками.

          * `config` — ссылка на `de.config`.

      * `de.Context.create(request)` — метод для создания контекста, возвращает promise,
        в который уже приходит готовый контекст. Сделано так потому, что если это `post`-запрос,
        то тело запроса (и параметры из него) получаются асинхронно.

  * Изменения в `de.Response`:

      * Больше не содержит ссылку на нодовский `http.ServerResponse`.

      * Появился метод `end(response, result)` — первым параметром принимает `http.ServerResponse`,
        второй (опциональный) — `de.Result`.
        Метод выставляет заголовки, код ответа, редиректы и т.д.
        Если передан `result`, то выводит его в поток (попутно выставляя `content-type`) и закрывает поток.

  * Изменения в `de.Request`:

      * Больше не содержит ссылку на нодовский `http.IncomingMessage`.

      * Имеет поля:

          * `headers` — http-заголовки, пришедшие в реквесте.

          * `cookies` — куки.

          * `url` — объект, получающийся из `require('url').parse(req.url, true, true)`.
            (http://nodejs.org/api/url.html#url_url)[http://nodejs.org/api/url.html#url_url].

            Если это был `POST`-запрос, то в `url.query` будут параметры из тела запроса.

          * `method` — метод (`GET`, `POST`, ...).

