'use strict';

var ec = require('./ec'),
	rsa = require('./rsa');

function getBaseAlgorithms (jwk) {
	var kty = jwk.kty;
	if ('string' !== typeof kty) {
		throw new TypeError('expected "jwk.kty" to be a String');
	}

	switch (kty) {
		case 'EC': {
			return ec(jwk);
		}
		case 'RSA': {
			return rsa(jwk);
		}
		default: {
			throw new Error('Unsupported key type "' + kty + '"');
		}
	}
}

function jwkAllowedAlgorithms (jwk) {
	if (null === jwk || 'object' !== typeof jwk) {
		throw new TypeError('Expected "jwk" to be an Object');
	}

	var baseAlgs = getBaseAlgorithms(jwk);

	var keyAlg = jwk.alg;
	if (keyAlg) {
		if (-1 === baseAlgs.indexOf(keyAlg)) {
			throw new Error('Expected "jwk.alg" to be one of "' + baseAlgs.join(', ') + '", saw "' + keyAlg + '"');
		}

		return [keyAlg];
	}

	return baseAlgs.slice();
}

module.exports = jwkAllowedAlgorithms;
