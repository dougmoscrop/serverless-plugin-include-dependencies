'use strict';

const path = require('path');

const _ = require('lodash');
const semver = require('semver');

const getDependencyList = require('./get-dependency-list');

module.exports = class IncludeDependencies {

  constructor(serverless, options) {
    if (!semver.satisfies(serverless.version, '>= 1.2')) {
      throw new Error('serverless-plugin-include-dependencies requires serverless 1.2 or higher!');
    }
    this.serverless = serverless;
    this.options = options;
    this.hooks = {
      'before:deploy:function:packageFunction': this.functionDeploy.bind(this),
      'before:deploy:createDeploymentArtifacts': this.createDeploymentArtifacts.bind(this)
    };
  }

  functionDeploy() {
    return this.processFunction(this.options.function);
  }

  createDeploymentArtifacts() {
    const service = this.serverless.service;
    if (typeof service.functions === 'object') {
      Object.keys(service.functions).forEach(functionName => {
        this.processFunction(functionName);
      });
    }
  }

  processFunction(functionName) {
    const service = this.serverless.service;

    service.package = service.package || {};
    service.package.exclude = _.union(service.package.exclude, ['node_modules/**']);

    const functionObject = service.functions[functionName];
    const runtime = this.getFunctionRuntime(functionObject);

    if (runtime.match(/nodejs*/)) {
      this.processNodeFunction(functionObject);
    }
  }

  processNodeFunction(functionObject) {
    const service = this.serverless.service;

    const fileName = this.getHandlerFilename(functionObject.handler)
    const list = this.getDependencies(fileName, this.serverless);

    if (service.package && service.package.individually) {
      functionObject.package = functionObject.package || {};
      this.include(functionObject.package, list);
    } else {
      this.include(service.package, list);
    }
  }

  getFunctionRuntime(functionObject) {
    const service = this.serverless.service;

    const functionRuntime = functionObject.runtime;
    const providerRuntime = service.provider && service.provider.runtime;

    return functionRuntime || providerRuntime || 'nodejs4.3';
  }

  getHandlerFilename(handler) {
    const handlerPath = handler.slice(0, handler.lastIndexOf('.'));
    return require.resolve((path.join(this.serverless.config.servicePath, handlerPath)));
  }

  getDependencies(fileName) {
    return getDependencyList(fileName, this.serverless);
  }

  include(target, paths) {
    const servicePath = this.serverless.config.servicePath;

    target.include = _.union(target.include, paths.map(p => path.relative(servicePath, p)));
  }

};
