'use strict';

module.exports.fn = () => {
  if (process.env) {
    const dependency1 = require('test-dep/file');
    const dependency2 = require('test-dep/file');
    return () => dependency1 + dependency2;
  }
};