'use strict';

const path = require('path');

const test = require('ava');

const getDependencyList = require('../get-dependency-list.js');

test('includes a deep dependency', (t) => {
  const fileName = path.join(__dirname, 'fixtures', 'thing.js');

  const list = getDependencyList(fileName);

  t.true(list.some(item => item.match(/jwa/)));
  t.true(list.some(item => item.match(/jwk-to-pem/)));
  t.true(list.some(item => item.match(/jwk-allowed-algorithms/)));

});

test('handles relative/project dependency', (t) => {
  const fileName = path.join(__dirname, 'fixtures', 'other', 'other-thing.js');

  const list = getDependencyList(fileName);

  t.true(list.some(item => item.match(/jwa/)));
});

test('should include local files', (t) => {
  const fileName = path.join(__dirname, 'fixtures', 'other', 'other-thing.js');

  const list = getDependencyList(fileName);

  t.true(list.some(item => path.basename(item) === 'other-thing.js'));
  t.true(list.some(item => path.basename(item) === 'thing.js'));
});
