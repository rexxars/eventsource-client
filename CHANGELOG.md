<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 1.0.0 (2023-11-14)

### ⚠ BREAKING CHANGES

- require node 18 or higher

### Features

- `onScheduleReconnect` event ([c2ad6fc](https://github.com/rexxars/eventsource-client/commit/c2ad6fcfbb8975790a1717990a5561bf3e2f9032))
- close connection when receiving http 204 ([5015171](https://github.com/rexxars/eventsource-client/commit/5015171116026d83300b3a814541c4e52833af4c))
- drop unnecessary environment abstractions ([f7d4fe5](https://github.com/rexxars/eventsource-client/commit/f7d4fe5532d37d9d6893aa193eb60082d86c44c3))
- initial commit ([e85503a](https://github.com/rexxars/eventsource-client/commit/e85503a56d499ddc4a3a34f12723a88b3a4045df))
- require node 18 or higher ([0186b45](https://github.com/rexxars/eventsource-client/commit/0186b458e8dc0969cb42243c4adfc61b1851b3b8))
- support AsyncIterator pattern ([264f9c3](https://github.com/rexxars/eventsource-client/commit/264f9c335fbdc07135ec6d85923ba3a2bd2d5705))
- trigger `onConnect()` ([d2293d7](https://github.com/rexxars/eventsource-client/commit/d2293d73538de55ee3cddebbd8740837832dd3ec))

### Bug Fixes

- esm/commonjs/web build ([9782a97](https://github.com/rexxars/eventsource-client/commit/9782a978c4b22f72d656f63479552e78dbbf7c89))
- move response body check after 204 check ([c196c5c](https://github.com/rexxars/eventsource-client/commit/c196c5ce9cfc7a4ef9ddcb49078700d0e8350d54))
- reset parser on disconnect/reconnect ([1534e03](https://github.com/rexxars/eventsource-client/commit/1534e030d72f2cba642084d92dbbc2f6176da5dd))
- reset parser on start of stream ([f4c1487](https://github.com/rexxars/eventsource-client/commit/f4c148756bcf9b5de5f9a0d5f512f25b4baf1b86))
- schedule a reconnect on network failure ([c00e0ca](https://github.com/rexxars/eventsource-client/commit/c00e0cae028b7572bd4ddf96c5763bde588ba976))
- set readyState to OPEN when connected ([06d448d](https://github.com/rexxars/eventsource-client/commit/06d448d424224a573423b214222c707766d95a64))
