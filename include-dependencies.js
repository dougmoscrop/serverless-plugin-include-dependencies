'use strict';

const path = require('path');

const semver = require('semver');
const micromatch = require('micromatch');
const glob = require('glob');
const fs = require('fs');

const getDependencyList = require('./get-dependency-list');

function union(a, b) {
  const arr = a || [];
  return Array.from(new Set(arr.concat(b || [])));
}

module.exports = class IncludeDependencies {

  constructor(serverless, options) {
    if (!semver.satisfies(serverless.version, '>= 1.13')) {
      throw new Error('serverless-plugin-include-dependencies requires serverless 1.13 or higher!');
    }

    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'before:deploy:function:packageFunction': this.functionDeploy.bind(this),
      'before:package:createDeploymentArtifacts': this.createDeploymentArtifacts.bind(this)
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

    const functionObject = service.functions[functionName];
    const runtime = this.getFunctionRuntime(functionObject);

    functionObject.package = functionObject.package || {};

    service.package = service.package || {};
    service.package.exclude = union(service.package.exclude, ['node_modules/**']);

    if (runtime === 'provided' || runtime.match(/nodejs*/)) {
      this.processIncludes(functionObject);
      this.processNodeFunction(functionObject);
    }
  }

  includeGlobs(target, include, exclude) {
    include.forEach(includeGlob => {
      this.include(target, [includeGlob]);
      glob.sync(path.join(this.serverless.config.servicePath, includeGlob))
        .filter(p => !exclude.some(e => {
          if (e.indexOf('node_modules') !== 0 || e === 'node_modules' || e === 'node_modules/**') {
            return false;
          }
          return micromatch.contains(p, e);
        }))
        .forEach(filePath => {
          var stat = fs.statSync(filePath);
          if (stat && stat.isFile()) {
            const dependencies = this.getDependencies(filePath, exclude);
            this.include(target, dependencies);
          }
        });
      }
    );
  }

  getPluginOptions() {
    const service = this.serverless.service;
    return (service.custom && service.custom.includeDependencies) || {};
  }

  processIncludes(functionObject) {
    const service = this.serverless.service;
    const options = this.getPluginOptions();
    if (!options || !options.always) {
      return;
    }
    const include = union(options.always, []);
    if (service.package && service.package.individually) {
      const exclude = union(service.package.exclude, functionObject.package.exclude);
      this.includeGlobs(functionObject, include, exclude);
    } else {
      const exclude = service.package.exclude || [];
      this.includeGlobs(service, include, exclude);
    }
  }

  processNodeFunction(functionObject) {
    const service = this.serverless.service;

    const fileName = this.getHandlerFilename(functionObject.handler);

    if (service.package && service.package.individually) {
      const exclude = union(service.package.exclude, functionObject.package.exclude);
      const dependencies = this.getDependencies(fileName, exclude);

      this.include(functionObject, dependencies);
    } else {
      const exclude = service.package.exclude;
      const dependencies = this.getDependencies(fileName, exclude);

      this.include(service, dependencies);
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

  getDependencies(fileName, exclude) {
    const servicePath = this.serverless.config.servicePath;
    const dependencies = this.getDependencyList(fileName);

    const relativeDependencies = dependencies.map(p => path.relative(servicePath, p));
    const exclusions = exclude.filter(e => {
      return !(e.indexOf('node_modules') !== 0 || e === 'node_modules' || e === 'node_modules/**');
    });

    return relativeDependencies.filter(p => {
      return !micromatch.some(p, exclusions);
    });
  }

  getDependencyList(fileName) {
    return getDependencyList(fileName, this.serverless);
  }

  include(target, dependencies) {
    target.package.include = union(target.package.include, dependencies);
  }

};
