# brightspace-auth-validation
[![Build Status](https://travis-ci.org/Brightspace/node-auth-validation.svg?branch=master)](https://travis-ci.org/Brightspace/node-auth-validation)

## Usage

```js
'use strict';

const http = require('http');
const validator = new (require('brightspace-auth-validation'))();

const server = http
	.createServer((req, res) => {
		validator
			.fromHeaders(req.headers)
			.then(token => {
				// token is a BrightspaceAuthToken instance
				res.statusCode = 201;
				res.end('Hi!\n');
			}, e => {
				console.error(e);
				res.statusCode = e.status || 403;
				res.end('Sorry, can\'t let you in!\n');
			});
	})
	.listen(3000);
```

### API

---

#### `new AuthTokenValidator([Object options])` -> `AuthTokenValidator`

##### Option: issuer `String` _(https://auth.brightspace.com/core)_

You may optionally specify the auth instance to connect to.

```js
...new AuthTokenValidator({ issuer: 'https://auth.brightspace.com/core' });
```

##### Option : maxClockSkew `Number` _(300)_

You may optionally specify the allowed clock skew, in seconds, when validating
time-based claims.

##### Option : maxKeyAge `Number` _(18000)_

_Deprecated soon_

You may optionally specify the length of time, in seconds, to trust a given key
without re-confirmation.

---

#### `.fromHeaders(Object headers)` -> `Promise<BrightspaceAuthToken>`

Given the incoming request headers, will attempt to extract and validate the
authorization signature.

---

#### `.fromSignature(String signature)` -> `Promise<BrightspaceAuthToken>`

Validates an authorization signature.

---

#### `.validateConfiguration()` -> `Promise<True>`

Will attempt to interact with the provided auth instance. Resolves if all is
well, or rejects with an error.


## Testing

```bash
npm test
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

This repository is configured with [EditorConfig][EditorConfig] and
[ESLint][ESLint] rules.

[EditorConfig]: http://editorconfig.org/
[ESLint]: http://eslint.org
