# ChangeLog

## 0.0.46

  * Откатил #57.

## 0.0.45

  * Merged pull request #57.

## 0.0.44

  * Merged pull request #55.

## 0.0.43

  * Merged pull request #54.

## 0.0.42

  * Merged pull request #51.

  * `require` должен работать в исполняемых descript'ом файлах. Например, в шаблонах,
    в jsx-файлах и т.д.

  * `nommon` версии `0.0.28`.

## 0.0.41

  * Merged pull request #50.

## 0.0.40

  * `de.server.route` — метод, возвращающий либо строку с путем к jsx-файлу, либо инсанс `de.Block.*`.

## 0.0.39

  * Пофикшен баг, когда внутри `de.Result.Value` оказывается `undefined` (например, если в блоке есть `options.result`,
    который вычисляется в `undefined`), после чего метод `write()` падает, потому что в поток можно вывести только `Buffer` или `String`.

## 0.0.38

  * Разные доработки по логированию.

  * `nommon` версии `0.0.26`.

## 0.0.37

  * Merged pull request #48.

## 0.0.36

  * Базовое [логирование](https://github.com/pasaran/descript/issues/46).

    В конфиге можно задать уровень логирования и logger:

        log: {
            //  По-умолчанию: 'debug'.
            //  Возможные значения: 'off', 'error', 'warn', 'info', 'debug'.
            level: 'debug',

            //  См. 'lib/de.logger.js' — дефолтный logger.
            logger: './my-logger.js'
        }

  * `nommon` версии `0.0.24`.

## 0.0.35

  * Merged pull request #44.

## 0.0.34

  * Merged pull request #42.

## 0.0.33

  * В `.jsx`-файлах доступен конфиг:

        de.object({
            //  Выводим весь конфиг целиком.
            config: de.value(de.config),

            //  Выводим отдельное поле конфига
            host: de.value(de.config.backend.host)
        })


## 0.0.32

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

