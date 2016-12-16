'use strict';

const util = require('util');

function BadJsonWebTokenError(message) {
	this.name = 'BadJsonWebTokenError';
	this.status = 401;
	this.message = message;

	Error.captureStackTrace(this, this.constructor);
}
util.inherits(BadJsonWebTokenError, Error);

function PublicKeyNotFoundError(kid) {
	this.name = 'PublicKeyNotFoundError';
	this.status = 403;
	this.message = `Public key "${ kid }" not found`;

	Error.captureStackTrace(this, this.constructor);
}
util.inherits(PublicKeyNotFoundError, Error);

function NoAuthorizationProvidedError() {
	this.name = 'NoAuthorizationProvidedError';
	this.status = 401;
	this.message = 'An authorization method wasn\'t provided';

	Error.captureStackTrace(this, this.constructor);
}
util.inherits(NoAuthorizationProvidedError, Error);

function PublicKeyLookupFailedError(inner) {
	this.name = 'PublicKeyLookupFailedError';
	this.status = 503;
	this.message = 'An error occurred while looking up public keys. Check auth service configuration.';
	this.inner = inner;

	if (inner && inner.stack) {
		this.stack = inner.stack;
	} else {
		Error.captureStackTrace(this, this.constructor);
	}
}
util.inherits(PublicKeyLookupFailedError, Error);

module.exports = {
	PublicKeyNotFound: PublicKeyNotFoundError,
	NoAuthorizationProvided: NoAuthorizationProvidedError,
	BadToken: BadJsonWebTokenError,
	PublicKeyLookupFailed: PublicKeyLookupFailedError
};
