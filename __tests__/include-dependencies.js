'use strict';

const path = require('path');

const _ = require('lodash');
const test = require('ava');
const sinon = require('sinon');

const IncludeDependencies = require('../include-dependencies.js');

function createTestInstance(serverless, options) {
  return new IncludeDependencies(
    _.merge({
      version: '1.2.0',
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
  t.throws(() => createTestInstance({ version: '1.1.1' }));
});

test('constructor should create hooks', t => {
  const instance = createTestInstance();

  t.deepEqual(Object.keys(instance.hooks), [
    'before:deploy:function:deploy',
    'before:deploy:createDeploymentArtifacts'
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

  sinon.stub(instance, 'getHandlerFilename', () => 'handler.js');
  sinon.stub(instance, 'getDependencies', () => []);

  instance.processFunction('a');

  t.deepEqual(instance.serverless.service.package.exclude, ['node_modules/**']);
});

test('processFunction should add node_modules to package exclude', t => {
  const instance = createTestInstance({
    service: {
      package: {
        exclude: ['.something']
      }
    }
  });

  sinon.stub(instance, 'getHandlerFilename', () => 'handler.js');
  sinon.stub(instance, 'getDependencies', () => []);

  instance.processFunction('a');

  t.deepEqual(instance.serverless.service.package.exclude, ['.something', 'node_modules/**']);
});

test('processFunction should add to package include', t => {
  const instance = createTestInstance({
    service: {
      package: {
        include: ['.something']
      }
    }
  });

  sinon.stub(instance, 'getHandlerFilename', () => 'handler.js');
  sinon.stub(instance, 'getDependencies', () => [
    path.join(__dirname, 'fixtures', 'node_modules', 'brightspace-auth-validation', '**'),
    path.join(__dirname, 'fixtures', 'node_modules', 'brightspace-auth-validation', 'node_modules', 'jws', '**'),
  ]);

  instance.processFunction('a');

  t.deepEqual(instance.serverless.service.package.include, [
    '.something',
    'node_modules/brightspace-auth-validation/**',
    'node_modules/brightspace-auth-validation/node_modules/jws/**'
  ]);
});

test('processFunction should include individually', t => {
  const instance = createTestInstance({
    service: {
      package: {
        individually: true,
        include: ['.something']
      },
      functions: {
        a: {
          package: {
            include: ['.something-else']
          }
        }
      }
    }
  });

  sinon.stub(instance, 'getHandlerFilename', () => 'handler.js');
  sinon.stub(instance, 'getDependencies', () => [
    path.join(__dirname, 'fixtures', 'node_modules', 'brightspace-auth-validation', '**'),
    path.join(__dirname, 'fixtures', 'node_modules', 'brightspace-auth-validation', 'node_modules', 'jws', '**'),
  ]);

  instance.processFunction('a');

  t.deepEqual(instance.serverless.service.package.include, [
    '.something'
  ]);
  t.deepEqual(instance.serverless.service.functions.a.package.include, [
    '.something-else',
    'node_modules/brightspace-auth-validation/**',
    'node_modules/brightspace-auth-validation/node_modules/jws/**'
  ]);
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
  const directory = path.join(__dirname, 'fixtures');
  const file = path.join(directory, 'thing.js');
  const dependencies = instance.getDependencies(file, directory);

  t.true(Array.isArray(dependencies));
  t.true(dependencies.length > 0);
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

  const processNode = sinon.stub(instance, 'processNodeFunction', () => true);

  instance.processFunction('a');

  t.false(processNode.called);

  instance.processFunction('b');

  t.true(processNode.calledOnce);

  instance.processFunction('c');

  t.true(processNode.calledTwice);
});
