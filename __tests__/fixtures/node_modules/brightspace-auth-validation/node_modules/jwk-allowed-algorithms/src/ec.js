'use strict';

var curveAlgorithms = {
	'P-256': ['ES256'],
	'P-384': ['ES384'],
	'P-521': ['ES512']
};

module.exports = function getEcDsaBaseAlgorithms (jwk) {
	var curve = jwk.crv;
	if ('string' !== typeof jwk.crv) {
		throw new TypeError('Expected "jwk.crv" to be a String');
	}

	var baseAlgorithms = curveAlgorithms[curve];
	if (baseAlgorithms) {
		return baseAlgorithms;
	}

	throw new Error('Unsupported curve "' + curve + '"');
};
