'use strict';

const path = require('path');

const semver = require('semver');
const micromatch = require('micromatch');
const glob = require('glob');

const getDependencyList = require('./get-dependency-list');

function union(a = [], b = []) {
  const existing = [].concat(a);
  const set = new Set(existing);

  [].concat(b).forEach(p => {
    if (set.has(p)) {
      return;
    }
    set.add(p);
    existing.push(p);
  });

  return existing;
}

module.exports = class IncludeDependencies {

  constructor(serverless, options) {
    if (!semver.satisfies(serverless.version, '>= 2.32')) {
      throw new Error('serverless-plugin-include-dependencies requires serverless 2.32 or higher!');
    }

    this.serverless = serverless;
    this.options = options;
    this.cache = new Set();
    this.checkedFiles = new Set();

    const service = this.serverless.service;
    this.individually = service.package && service.package.individually;

    this.hooks = {
      'before:deploy:function:packageFunction': this.functionDeploy.bind(this),
      'before:package:createDeploymentArtifacts': this.createDeploymentArtifacts.bind(this)
    };
  }

  functionDeploy() {
    return this.processFunction(this.options.function);
  }

  createDeploymentArtifacts() {
    const { service = {} } = this.serverless;
    const { functions = {} } = service;

    for (const functionName in functions) {
      this.processFunction(functionName);
    }

    const files = [...new Set(this.getPatterns().filter(pattern => !pattern.startsWith('!') && !pattern.includes('node_modules'))
      .map(modulePath => glob.sync(modulePath, {
          nodir: true,
          ignore: path.join(modulePath, 'node_modules', '**'),
          absolute: true
        })
      ).flat().map(file => file.replaceAll('\\', '/')))];

    files.forEach(fileName => {
      if (!this.checkedFiles.has(fileName)) {
        const dependencies = this.getDependencies(fileName, service.package.patterns);
        service.package.patterns = union(service.package.patterns, dependencies);
      }
    });

    this.checkedFiles.clear();
  }

  processFunction(functionName) {
    const { service = {} } = this.serverless;

    service.package = service.package || {};
    service.package.patterns = union(['!node_modules/**'], service.package.patterns);

    const functionObject = service.functions[functionName];
    const runtime = this.getFunctionRuntime(functionObject);

    if (/(provided|nodejs)+/.test(runtime)) {
      this.processNodeFunction(functionObject);
    }
  }

  getPatterns() {
    const service = this.serverless.service;
    return (service.package && service.package.patterns) || [];
  }

  getPluginOptions() {
    const service = this.serverless.service;
    return (service.custom && service.custom.includeDependencies) || {};
  }

  processNodeFunction(functionObject) {
    const { service } = this.serverless;

    functionObject.package = functionObject.package || {};

    const fileName = this.getHandlerFilename(functionObject.handler);
    const dependencies = this.getDependencies(fileName, service.package.patterns);

    const target = this.individually ? functionObject : service;
    target.package.patterns = union(target.package.patterns, dependencies);
  }

  getFunctionRuntime(functionObject) {
    const { service } = this.serverless;

    const functionRuntime = functionObject.runtime;
    const providerRuntime = service.provider && service.provider.runtime;

    return functionRuntime || providerRuntime;
  }

  getHandlerFilename(handler) {
    const lastDotIndex = handler.lastIndexOf('.');
    const handlerPath = lastDotIndex !== -1 ? handler.slice(0, lastDotIndex) : 'index';
    return require.resolve((path.join(this.serverless.config.servicePath, handlerPath)));
  }

  getDependencies(fileName, patterns) {
    const servicePath = this.serverless.config.servicePath;
    const dependencies = this.getDependencyList(fileName) || [];
    const relativeDependencies = dependencies.map(p => path.relative(servicePath, p));

    const exclusions = patterns.filter(p => {
      return !(p.indexOf('!node_modules') !== 0 || p === '!node_modules' || p === '!node_modules/**');
    });

    if (exclusions.length > 0) {
      return micromatch(relativeDependencies, exclusions);
    }

    return relativeDependencies;
  }

  getDependencyList(fileName) {
    if (!this.individually) {
      const options = this.getPluginOptions();
      if (options && options.enableCaching) {
        return getDependencyList(fileName, this.serverless, this.checkedFiles, this.cache);
      }
    }
    return getDependencyList(fileName, this.serverless, this.checkedFiles);
  }
};
