ChangeLog
=========

0.0.31
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

          * `url` — объект, получающийся из `require('url').parse(req.url, true, true).
            (http://nodejs.org/api/url.html#url_url)[http://nodejs.org/api/url.html#url_url].

            Если это был `POST`-запрос, то в `url.query` будут параметры из тела запроса.

          * `method` — метод (`GET`, `POST`, ...).

