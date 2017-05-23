'use strict';

const path = require('path');

module.exports = {

  isOutside(base, location) {
    const relative = path.relative(base, location);

    return !!(relative && relative.indexOf('..') !== -1);
  }

};
