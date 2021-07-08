'use strict';

const path = require('path');

const _ = require('lodash');
const test = require('ava');
const sinon = require('sinon');

const IncludeDependencies = require('../include-dependencies.js');

function createTestInstance(serverless, options) {
  return new IncludeDependencies(
    _.merge({
      version: '2.32.0',
      config: {
        servicePath: path.join(__dirname, 'fixtures')
      },
      service: {
        functions: {
          a: {},
          b: {}
        }
      }
    }, serverless),
    _.merge({}, options)
  );
}

test('constructor should throw on older version', t => {
  t.throws(() => createTestInstance({ version: '1.12.0' }));
});

test('constructor should create hooks', t => {
  const instance = createTestInstance();

  t.deepEqual(Object.keys(instance.hooks), [
    'before:deploy:function:packageFunction',
    'before:package:createDeploymentArtifacts'
  ]);
});

test('constructor should set properties', t => {
  const instance = createTestInstance(undefined, { function: 'some-name' });

  t.truthy(instance.serverless.service);
  t.truthy(instance.options.function);
});

test('functionDeploy should call processFunction with function name', t => {
  const instance = createTestInstance(undefined, { function: 'foo' });
  const spy = sinon.stub(instance, 'processFunction');

  instance.functionDeploy();

  t.deepEqual(spy.calledOnce, true);
  t.deepEqual(spy.calledWith('foo'), true);
});

test('createDeploymentArtifacts should call processFunction with function name', t => {
  const instance = createTestInstance();

  const spy = sinon.stub(instance, 'processFunction');

  instance.createDeploymentArtifacts();

  t.deepEqual(spy.calledTwice, true);
  t.deepEqual(spy.calledWith('a'), true);
  t.deepEqual(spy.calledWith('b'), true);
});

test('processFunction should exclude node_modules when no package defined', t => {
  const instance = createTestInstance();

  sinon.stub(instance, 'getHandlerFilename').returns('handler.js');
  sinon.stub(instance, 'getDependencies').returns([]);

  instance.processFunction('a');

  t.deepEqual(instance.serverless.service.package.patterns, ['!node_modules/**']);
});

test('processFunction should add node_modules ignore to package patterns', t => {
  const instance = createTestInstance({
    service: {
      package: {
        patterns: ['.something']
      }
    }
  });

  sinon.stub(instance, 'getHandlerFilename').returns('handler.js');
  sinon.stub(instance, 'getDependencies').returns([]);

  instance.processFunction('a');

  t.deepEqual(instance.serverless.service.package.patterns, ['!node_modules/**', '.something']);
});

test('processFunction should add to package include', t => {
  const instance = createTestInstance({
    service: {
      provider: {
        runtime: 'nodejs14.x',
      },
      package: {
        patterns: ['.something']
      }
    }
  });

  sinon.stub(instance, 'getHandlerFilename').returns('handler.js');
  sinon.stub(instance, 'getDependencies').returns([
    path.join('node_modules', 'brightspace-auth-validation', 'index.js'),
    path.join('node_modules', 'brightspace-auth-validation', 'node_modules', 'jws', 'index.js'),
  ]);

  instance.processFunction('a');

  t.deepEqual(instance.serverless.service.package.patterns, [
    '!node_modules/**',
    '.something',
    'node_modules/brightspace-auth-validation/index.js',
    'node_modules/brightspace-auth-validation/node_modules/jws/index.js'
  ]);
});

test('processFunction should include individually', t => {
  const instance = createTestInstance({
    service: {
      provider: {
        runtime: 'nodejs14.x',
      },
      package: {
        individually: true,
        patterns: ['.something']
      },
      functions: {
        a: {
          package: {
            patterns: ['.something-else']
          }
        }
      }
    }
  });

  sinon.stub(instance, 'getHandlerFilename').returns('handler.js');
  sinon.stub(instance, 'getDependencies').returns([
    path.join('node_modules', 'brightspace-auth-validation', 'index.js'),
    path.join('node_modules', 'brightspace-auth-validation', 'node_modules', 'jws', 'index.js'),
  ]);

  instance.processFunction('a');

  t.deepEqual(instance.serverless.service.package.patterns, [
    '!node_modules/**',
    '.something',
  ]);
  t.deepEqual(instance.serverless.service.functions.a.package.patterns, [
    '.something-else',
    'node_modules/brightspace-auth-validation/index.js',
    'node_modules/brightspace-auth-validation/node_modules/jws/index.js'
  ]);
});

test('getHandlerFilename should default to index where there is no . in the handler name', t => {
  const instance = createTestInstance();

  t.deepEqual(instance.getHandlerFilename('https'), path.join(__dirname, 'fixtures', 'index.js'));
});

test('getHandlerFilename should handle a simple handler expression', t => {
  const instance = createTestInstance();

  t.deepEqual(instance.getHandlerFilename('thing.handler'), path.join(__dirname, 'fixtures', 'thing.js'));
});

test('getHandlerFilename should handle a handler expression with a path', t => {
  const instance = createTestInstance();

  t.deepEqual(instance.getHandlerFilename('thing.handler'), path.join(__dirname, 'fixtures', 'thing.js'));
});

test('getDependencies should return an array', t => {
  const instance = createTestInstance();
  const file = path.join(__dirname, 'fixtures', 'thing.js');
  const dependencies = instance.getDependencies(file, []);

  t.true(Array.isArray(dependencies));
  t.true(dependencies.length > 0);
});

test('getDependencies - exclude a folder within a dependency', t => {
  const instance = createTestInstance();
  const file = path.join(__dirname, 'fixtures', 'thing.js');
  const dependencies = instance.getDependencies(file, [
    '!node_modules/**/brightspace-auth-validation/src/**'
  ]);

  t.true(Array.isArray(dependencies));
  t.true(dependencies.length > 0);
  t.true(dependencies.some(p => p.match(/brightspace-auth-validation\/package\.json/)));
  t.true(dependencies.some(p => p.match(/bn.js\/lib\/bn.js/)));
  t.false(dependencies.some(p => p.match(/brightspace-auth-validation\/src/)));
});

test('getDependencies should handle exclude of a file within a dependency', t => {
  const instance = createTestInstance();
  const file = path.join(__dirname, 'fixtures', 'thing.js');
  const dependencies = instance.getDependencies(file, [
    '!node_modules/**/brightspace-auth-validation/LICENSE'
  ]);

  t.true(Array.isArray(dependencies));
  t.true(dependencies.length > 0);
  t.false(dependencies.some(p => p.match(/brightspace-auth-validation\/LICENSE/)));
  t.true(dependencies.some(p => p.match(/readable-stream\/LICENSE/)));
});

test('getDependencies should ignore excludes that do not start with node_modules', t => {
  const instance = createTestInstance();
  const file = path.join(__dirname, 'fixtures', 'thing.js');
  const dependencies = instance.getDependencies(file, [
    '**/LICENSE'
  ]);

  t.true(Array.isArray(dependencies));
  t.true(dependencies.length > 0);
  t.true(dependencies.some(p => p.match(/brightspace-auth-validation\/LICENSE/)));
  t.true(dependencies.some(p => p.match(/readable-stream\/LICENSE/)));
});

test('getDependencies should handle exclude of all files with a name', t => {
  const instance = createTestInstance();
  const file = path.join(__dirname, 'fixtures', 'thing.js');
  const dependencies = instance.getDependencies(file, [
    '!node_modules/**/LICENSE*',
    '!node_modules/**/Makefile'
  ]);

  t.true(Array.isArray(dependencies));
  t.true(dependencies.length > 0);
  t.false(dependencies.some(p => p.match(/brightspace-auth-validation\/LICENSE/)));
  t.false(dependencies.some(p => p.match(/readable-stream\/LICENSE/)));
  t.false(dependencies.some(p => p.match(/Makefile/)));
});

test('getDependencies should handle exclude patterns in node_modules', t => {
  const instance = createTestInstance();
  const file = path.join(__dirname, 'fixtures', 'thing.js');
  const dependencies = instance.getDependencies(file, [
    '!node_modules/**/*_browser.js'
  ]);

  t.true(Array.isArray(dependencies));
  t.true(dependencies.length > 0);
  t.false(dependencies.some(p => p.match(/inherits_browser.js/)));
});

test('getDependencies should handle excluding an entire module', t => {
  const instance = createTestInstance();
  const file = path.join(__dirname, 'fixtures', 'thing.js');
  const dependencies = instance.getDependencies(file, [
    '!node_modules/**/jwk-to-pem/**'
  ]);

  t.true(Array.isArray(dependencies));
  t.true(dependencies.length > 0);
  t.false(dependencies.some(p => p.match(/jwk-to-pem/)));
});

test('getDependencies should handle excluding an scoped module', t => {
  const instance = createTestInstance();
  const file = path.join(__dirname, 'fixtures', 'scoped-dep-file.js');
  const dependencies = instance.getDependencies(file, [
    'node_modules/**/@test/scoped-dep/**' // todo why no difference
  ]);

  t.true(Array.isArray(dependencies));
  t.true(dependencies.length > 0);
  t.true(dependencies[0] === 'scoped-dep-file.js');
});

test('processFunction should handle different runtimes', t => {
  const instance = createTestInstance({
    service: {
      provider: {
        runtime: 'python23',
      },
      package: {
        individually: true,
        include: ['.something']
      },
      functions: {
        a: {},
        b: {
          runtime: 'nodejs43'
        },
        c: {
          runtime: 'nodejs62'
        }
      }
    }
  });

  const processNode = sinon.stub(instance, 'processNodeFunction').returns(true);

  instance.processFunction('a');

  t.false(processNode.called);

  instance.processFunction('b');

  t.true(processNode.calledOnce);

  instance.processFunction('c');

  t.true(processNode.calledTwice);
});

test('disables caching by default', t => {
  const instance = createTestInstance();
  const file = path.join(__dirname, 'fixtures', 'thing.js');
  const list1 = instance.getDependencies(file, []);
  const list2 = instance.getDependencies(file, []);
  t.deepEqual(list1, list2);
});

test('enables caching', t => {
  const instance = createTestInstance({
    service: { custom: { includeDependencies: { enableCaching: true } } }
  });
  const file = path.join(__dirname, 'fixtures', 'thing.js');
  const list1 = instance.getDependencies(file, []);
  const list2 = instance.getDependencies(file, []);
  t.true(list2.length < list1.length);
});
