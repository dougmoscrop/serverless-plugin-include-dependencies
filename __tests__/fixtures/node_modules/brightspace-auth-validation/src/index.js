'use strict';

const
	assert = require('assert'),
	AuthToken = require('brightspace-auth-token'),
	jwkAllowedAlgorithms = require('jwk-allowed-algorithms'),
	jwkToPem = require('jwk-to-pem'),
	jws = require('jws'),
	request = require('superagent');

const
	errors = require('./errors'),
	promised = require('./promised');

const
	DEFAULT_ISSUER = 'https://auth.brightspace.com/core',
	DEFAULT_MAX_CLOCK_SKEW = 5 * 60,
	DEFAULT_MAX_KEY_AGE = 5 * 60 * 60,
	JWKS_PATH = '/.well-known/jwks';

function clock() {
	return Math.round(Date.now() / 1000);
}

function processJwks(jwks, knownPublicKeys, maxKeyAge) {
	assert('object' === typeof jwks);
	assert(Array.isArray(jwks.keys));
	assert(knownPublicKeys instanceof Map);
	assert('number' === typeof maxKeyAge);

	const
		currentPublicKeys = new Map(),
		expiry = clock() + maxKeyAge;

	for (const jwk of jwks.keys) {
		assert('object' === typeof jwk);
		assert('string' === typeof jwk.kid);

		const pem = knownPublicKeys.has(jwk.kid)
			? knownPublicKeys.get(jwk.kid).pem
			: jwkToPem(jwk);
		const allowedAlgorithms = jwkAllowedAlgorithms(jwk);

		currentPublicKeys.set(jwk.kid, {
			expiry: expiry,
			pem: pem,
			allowedAlgorithms: allowedAlgorithms
		});
	}

	return currentPublicKeys;
}

function AuthTokenValidator(opts) {
	if (!(this instanceof AuthTokenValidator)) {
		return new AuthTokenValidator(opts);
	}

	opts = opts || {};

	this._maxClockSkew = DEFAULT_MAX_CLOCK_SKEW;
	const maxClockSkewOpt = opts.maxClockSkew;
	if ('undefined' !== typeof maxClockSkewOpt) {
		if ('number' !== typeof maxClockSkewOpt || maxClockSkewOpt < 0) {
			throw new TypeError(
				`Expected "opts.maxClockSkew" to be a non-negative Number. Got "${ maxClockSkewOpt }" (${typeof maxClockSkewOpt}).`
			);
		}
		this._maxClockSkew = maxClockSkewOpt;
	}

	const issuer = 'string' === typeof opts.issuer ? opts.issuer.replace(/\/+$/g, '') : DEFAULT_ISSUER;

	this._jwksUri = `${ issuer }${ JWKS_PATH }`;
	this._maxKeyAge = 'number' === typeof opts.maxKeyAge ? opts.maxKeyAge : DEFAULT_MAX_KEY_AGE;
	this._keyCache = new Map();
	this._keysUpdating = null;
}

AuthTokenValidator.prototype.fromHeaders = promised(/* @this */function getValidatedAuthTokenFromHeaders(headers) {
	assert('object' === typeof headers);

	const authHeader = headers.authorization;
	if (!authHeader) {
		throw new errors.NoAuthorizationProvided();
	}

	const signatureMatch = authHeader.match(/^Bearer (.+)$/);
	if (!signatureMatch) {
		throw new errors.NoAuthorizationProvided();
	}

	const signature = signatureMatch[1];

	return this.fromSignature(signature);
});

AuthTokenValidator.prototype.fromSignature = promised(/* @this */function getValidatedAuthTokenFromSignature(signature) {
	assert('string' === typeof signature);

	const token = decodeSignature(signature);
	const claims = this._validateClaims(token);

	return this
		._getPublicKey(token)
		.then(function verifyWithKey(publicKey) {
			return verifySignature(signature, token, publicKey);
		})
		.then(function returnToken() {
			return new AuthToken(claims, signature);
		});
});

function decodeSignature(signature) {
	assert('string' === typeof signature);

	let decodedToken = null;
	try {
		decodedToken = jws.decode(signature);
	} catch (e) {
		throw new errors.BadToken('Not a valid JWT');
	}

	if (!decodedToken) {
		throw new errors.BadToken('Not a valid JWT');
	}

	const header = decodedToken.header;

	if ('string' !== typeof header.kid) {
		throw new errors.BadToken('Missing "kid" header');
	}

	if ('string' !== typeof header.alg) {
		throw new errors.BadToken('Missing "alg" header');
	}

	return decodedToken;
}

AuthTokenValidator.prototype._validateClaims = function validateClaims(token) {
	const claims = token.payload;
	const now = clock();

	if ('undefined' !== typeof claims.exp) {
		const exp = claims.exp;
		if ('number' !== typeof exp) {
			throw new errors.BadToken('Invalid "exp" claim');
		}

		const diff = now - exp;
		if (diff >= this._maxClockSkew) {
			throw new errors.BadToken(`Token expired (${diff} seconds)`);
		}
	}

	if ('undefined' !== typeof claims.nbf) {
		const nbf = claims.nbf;
		if ('number' !== typeof nbf) {
			throw new errors.BadToken('Invalid "nbf" claim');
		}

		const diff = now - nbf;

		if (diff < -1 * this._maxClockSkew) {
			throw new errors.BadToken(`Token not yet valid (${diff} seconds)`);
		}
	}

	return claims;
};

AuthTokenValidator.prototype._getPublicKey = function getPublicKey(token) {
	assert('object' === typeof token);
	assert('object' === typeof token.header);

	const kid = token.header.kid;

	assert('string' === typeof kid);

	if (this._keyCache.has(kid)) {
		const publicKey = this._keyCache.get(kid);

		if (clock() < publicKey.expiry) {
			return Promise.resolve(publicKey);
		}
	}

	const self = this;

	return this
		._updatePublicKeys()
		.then(function() {
			if (self._keyCache.has(kid)) {
				return self._keyCache.get(kid);
			}

			throw new errors.PublicKeyNotFound(kid);
		});
};

AuthTokenValidator.prototype._updatePublicKeys = function updatePublicKeys() {
	const self = this;

	if (!this._keysUpdating) {
		this._keysUpdating = new Promise(function(resolve, reject) {
			request
				.get(self._jwksUri)
				.end(function(err, res) {
					if (err) {
						reject(new errors.PublicKeyLookupFailed(err));
						return;
					}

					resolve(res.body);
				});
		}).then(function(jwks) {
			self._keyCache = processJwks(jwks, self._keyCache, self._maxKeyAge);
			self._keysUpdating = null;
		}).catch(function(e) {
			self._keysUpdating = null;
			throw e;
		});
	}

	return this._keysUpdating;
};

function verifySignature(signature, token, publicKey) {
	const alg = matchAlgorithm(publicKey, token);

	let verified = false;
	try {
		verified = jws.verify(signature, alg, publicKey.pem);
	} catch (e) {
		throw new errors.BadToken('Error during signature verification');
	}

	if (!verified) {
		throw new errors.BadToken('Invalid signature');
	}
}

function matchAlgorithm(publicKey, token) {
	const requestedAlgorithm = token.header.alg;
	const allowedAlgorithms = publicKey.allowedAlgorithms;

	if (-1 === allowedAlgorithms.indexOf(requestedAlgorithm)) {
		throw new errors.BadToken('Token listed bad algorithm for key, "' + requestedAlgorithm + '"');
	}

	return requestedAlgorithm;
}

function returnTrue() {
	return true;
}
AuthTokenValidator.prototype.validateConfiguration = function() {
	return this
		._updatePublicKeys()
		.then(returnTrue);
};

module.exports = AuthTokenValidator;
module.exports.errors = errors;
