'use strict';

const path = require('path');

const precinct = require('precinct');
const resolve = require('resolve');
const resolvePkg = require('resolve-pkg');
const requirePackageName = require('require-package-name');
const glob = require('glob');

const utils = require('./utils');

const alwaysIgnored = new Set(['aws-sdk']);

function ignoreMissing(dependency, optional) {
  return alwaysIgnored.has(dependency) || (optional && dependency in optional);
}

function invalidReference(path) {
  throw new Error(`A dependency was located outside of the service directory - at ${path} - this is unsupported and is usually caused by using 'npm link'. See https://github.com/dougmoscrop/serverless-plugin-include-dependencies/issues/14`);
}

module.exports = function(filename, serverless) {
  const servicePath = serverless.config.servicePath;

  const filePaths = new Set();
  const modulePaths = new Set();

  const localFilesToProcess = [filename];

  while (localFilesToProcess.length) {
    const currentLocalFile = localFilesToProcess.pop();

    if (filePaths.has(currentLocalFile)) {
      continue;
    }

    filePaths.add(currentLocalFile);

    precinct.paperwork(currentLocalFile).forEach(name => {
      if (resolve.isCore(name) || alwaysIgnored.has(name)) {
        return;
      }

      if (name.indexOf('.') === 0) {
        const abs = resolve.sync(name, {
          basedir: path.dirname(currentLocalFile)
        });
        localFilesToProcess.push(abs);
      } else {
        const moduleName = requirePackageName(name.replace(/\\/, '/'));
        const pathToModule = resolvePkg(moduleName, {
          cwd: servicePath
        });

        if (pathToModule) {
          if (utils.isOutside(servicePath, pathToModule)) {
            invalidReference(pathToModule);
          }
          modulePaths.add(pathToModule);
        } else {
          if (ignoreMissing(moduleName)) {
            return;
          }
          throw new Error(`[serverless-plugin-include-dependencies]: Could not find ${moduleName}`);
        }
      }
    });
  }

  const modulePathsToProcess = Array.from(modulePaths);

  modulePaths.clear();

  while (modulePathsToProcess.length) {
    const currentModulePath = modulePathsToProcess.pop();

    if (modulePaths.has(currentModulePath)) {
      continue;
    }

    modulePaths.add(currentModulePath);

    const packageJson = require(path.join(currentModulePath, 'package.json'));

    ['dependencies', 'peerDependencies', 'optionalDependencies'].forEach(key => {
      const dependencies = packageJson[key];

      if (dependencies) {
        Object.keys(dependencies).forEach(dependency => {
          if (alwaysIgnored.has(dependency)) {
            return;
          }

          const pathToModule = resolvePkg(dependency, {
            cwd: currentModulePath
          });

          if (pathToModule) {
            if (utils.isOutside(servicePath, pathToModule)) {
              invalidReference(pathToModule);
            }
            modulePathsToProcess.push(pathToModule);
          } else {
            if (ignoreMissing(dependency, packageJson.optionalDependencies)) {
              serverless.cli.log(`[serverless-plugin-include-dependencies]: WARNING missing optional dependency: ${dependency}`);
              return;
            }
            throw new Error(`[serverless-plugin-include-dependencies]: Could not find ${key}:${dependency}`);
          }
        });
      }
    });
  }

  modulePaths.forEach(modulePath => {
    const moduleFilePaths = glob.sync(path.join(modulePath, '**'), {
      nodir: true,
      ignore: path.join(modulePath, 'node_modules', '**'),
      absolute: true
    });

    moduleFilePaths.forEach(moduleFilePath => {
      filePaths.add(moduleFilePath);
    });
  });

  return Array.from(filePaths);
};
