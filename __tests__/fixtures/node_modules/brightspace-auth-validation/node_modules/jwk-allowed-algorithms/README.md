# jwk-allowed-algorithms

[![Build Status](https://travis-ci.org/Brightspace/node-jwk-allowed-algorithms.svg?branch=master)](https://travis-ci.org/Brightspace/node-jwk-allowed-algorithms) [![Coverage Status](https://coveralls.io/repos/Brightspace/node-jwk-allowed-algorithms/badge.svg)](https://coveralls.io/r/Brightspace/node-jwk-allowed-algorithms)

A tiny library to provide a list of [jwa algorithms][algs] allowed to be used
with a particular [json web key][jwk].

## Install
```sh
npm install jwk-allowed-algorithms --save
```

## Usage
```js
var getAllowedAlorithms = require('jwk-allowed-algorithms'),
	jwt = require('jsonwebtoken');

var jwk = { kty: 'EC', crv: 'P-256', x: '...', y: '...' },
	pem = jwkToPem(jwk);

var allowedAlgorithms = getAllowedAlorithms(jwk); // ['ES256']

jwt.verify(token, pem, { algorithms: allowedAlgorithms });
```

## Contributing

1. **Fork** the repository. Committing directly against this repository is
   highly discouraged.

2. Make your modifications in a branch, updating and writing new unit tests
   as necessary in the `spec` directory.

3. Ensure that all tests pass with `npm test`

4. `rebase` your changes against master. *Do not merge*.

5. Submit a pull request to this repository. Wait for tests to run and someone
   to chime in.

### Code Style

This repository is configured with [EditorConfig][EditorConfig], [jscs][jscs]
and [JSHint][JSHint] rules.

[algs]: https://tools.ietf.org/html/rfc7518#section-3.1
[jwk]: https://tools.ietf.org/html/rfc7517
[EditorConfig]: http://editorconfig.org/
[jscs]: http://jscs.info/
[JSHint]: http://jshint.com/
