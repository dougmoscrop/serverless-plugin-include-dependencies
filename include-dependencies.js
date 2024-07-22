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

    this.hooks = {
      'before:deploy:function:packageFunction': this.functionDeploy.bind(this),
      'before:package:createDeploymentArtifacts': this.createDeploymentArtifacts.bind(this)
    };
  }

  shouldPackageIndividually(functionObject) {
    const functionObjectPkg = functionObject.package || {};
    if (functionObjectPkg.individually === true || functionObjectPkg.individually === false) {
      return functionObjectPkg.individually;
    }
    return this.serverless.service.package?.individually;
  }

  functionDeploy() {
    return this.processFunction(this.options.function);
  }

  addDependenciesForTarget(target, useCache = false) {
    const filteredPatterns = this.getPatterns(target).filter(pattern => !pattern.startsWith('!') && !pattern.includes('node_modules'));
    const files = Array.from(new Set(filteredPatterns))
      .map(modulePath => glob.sync(modulePath, {
          nodir: true,
          ignore: path.join(modulePath, 'node_modules', '**'),
          absolute: true
        })
      ).flat().map(file => file.replaceAll('\\', '/'));

    files.forEach(fileName => {
        const dependencies = this.getDependencies(fileName, target.package.patterns, useCache);
        target.package.patterns = union(target.package.patterns, dependencies);
    });
  }

  get cacheEnabled() {
    return this.getPluginOptions().enableCaching
  }

  createDeploymentArtifacts() {
    const { service = {} } = this.serverless;
    const { functions = {} } = service;

    for (const functionName in functions) {
      this.processFunction(functionName);
    }

    const individually = this.serverless.service.package?.individually;
    this.addDependenciesForTarget(service, !individually && this.cacheEnabled);
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

  getPatterns(target) {
    return target.package?.patterns || [];
  }

  getPluginOptions() {
    return this.serverless.service.custom?.includeDependencies || {};
  }

  processNodeFunction(functionObject) {
    const { service } = this.serverless;

    functionObject.package = functionObject.package || {};

    const fileName = this.getHandlerFilename(functionObject.handler);
    const individually = this.shouldPackageIndividually(functionObject);
    const enableCaching = !individually && this.getPluginOptions().enableCaching;
    
    const target = individually ? functionObject : service;
    const patterns = individually ? union(service.package.patterns || [], target.package.patterns || []) : target.package.patterns || []

    const dependencies = this.getDependencies(fileName, patterns, enableCaching && this.cache);
    target.package.patterns = union(target.package.patterns, dependencies);

    if (!individually) { return; }
    this.addDependenciesForTarget(functionObject);
  }

  getFunctionRuntime(functionObject) {
    const { service } = this.serverless;

    const functionRuntime = functionObject.runtime;
    const providerRuntime = service.provider?.runtime;

    return functionRuntime || providerRuntime;
  }

  getHandlerFilename(handler) {
    const lastDotIndex = handler.lastIndexOf('.');
    const handlerPath = lastDotIndex !== -1 ? handler.slice(0, lastDotIndex) : 'index';

    const root = this.getPluginOptions().handlerRoot || this.serverless.config.servicePath;

    return require.resolve((path.join(root, handlerPath)));
  }

  getDependencies(fileName, patterns, useCache = false) {
    const servicePath = this.serverless.config.servicePath;
    const dependencies = getDependencyList(fileName, this.serverless, useCache && this.cache) || [];
    const relativeDependencies = dependencies.map(p => path.relative(servicePath, p));

    const exclusions = patterns.filter(p => {
      return !(p.indexOf('!node_modules') !== 0 || p === '!node_modules' || p === '!node_modules/**');
    });

    if (exclusions.length > 0) {
      return micromatch(relativeDependencies, exclusions);
    }

    return relativeDependencies;
  }
};
