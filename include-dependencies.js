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

    this.filterDeps = {};
    if (serverless.service.custom &&
      serverless.service.custom['serverless-plugin-include-dependencies']) {
        this.filterDeps = serverless.service.custom['serverless-plugin-include-dependencies'];
    }

    this.hooks = {
      'before:deploy:function:deploy': this.functionDeploy.bind(this),
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
    const fileName = this.getHandlerFilename(functionObject.handler)
    const list = this.getDependencies(fileName, this.serverless);

    if (service.package && service.package.individually) {
      functionObject.package = functionObject.package || {};
      this.include(functionObject.package, list);
    } else {
      this.include(service.package, list);
    }
  }

  getHandlerFilename(handler) {
    const handlerPath = handler.slice(0, handler.lastIndexOf('.'));
    return require.resolve((path.join(this.serverless.config.servicePath, handlerPath)));
  }

  getDependencies(fileName) {
    return getDependencyList(fileName, this.serverless, this.filterDeps);
  }

  include(target, paths) {
    const servicePath = this.serverless.config.servicePath;

    target.include = _.union(target.include, paths.map(p => path.relative(servicePath, p)));
  }

};
