'use strict';

function promised(fn) {
	return /* @this */ function() {
		var args = new Array(arguments.length),
			that = this;
		for (var i = 0, n = args.length; i < n; ++i) {
			args[i] = arguments[i];
		}

		return new Promise(function(resolve) {
			resolve(fn.apply(that, args));
		});
	};
}

module.exports = promised;
