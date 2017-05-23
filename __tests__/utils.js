'use strict';

const test = require('ava');

const utils = require('../utils');

test('isOutside', (t) => {
  t.true(utils.isOutside('/c/foo/bar', '/c/foo'));
  t.true(utils.isOutside('/c/foo/bar', '../qwekjsakdfhsdahfjas'));
  t.true(utils.isOutside('/c/foo/bar', '/c/foo/bar/baz/../..'));
  t.true(utils.isOutside('/c/foo/bar', '/c/foo/bar/baz/../../asdf.js'));
  t.true(utils.isOutside('/c/foo/bar', '../../../../../../fdfsdfadjfkzjz'));

  t.false(utils.isOutside('/c/foo/bar', '/c/foo/bar'));
  t.false(utils.isOutside('/c/foo/bar', '/c/foo/bar/baz'));
  t.false(utils.isOutside('/c/foo/bar', '/c/foo/bar/baz/..'));
  t.false(utils.isOutside('/c/foo/bar', '/c/foo/bar/baz/blah.js'));
  t.false(utils.isOutside('/c/foo/bar', '/c/foo/bar/baz/../blah.js'));
});
