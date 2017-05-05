'use strict';

const path = require('path');

const precinct = require('precinct');
const resolve = require('resolve');
const resolvePkg = require('resolve-pkg');
const requirePackageName = require('require-package-name');
const glob = require('glob');

module.exports = function(filename, serverless) {
  const base = path.dirname(filename);

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
      if (resolve.isCore(name)) {
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
          cwd: base
        });

        if (pathToModule) {
          modulePaths.add(pathToModule);
        } else {
          throw new Error(`[serverless-plugin-include-dependencies]: Could not find ${name}`);
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

    if (packageJson.dependencies) {
      Object.keys(packageJson.dependencies).forEach(dependency => {
        const pathToModule = resolvePkg(dependency, {
          cwd: currentModulePath
        });

        if (pathToModule) {
          modulePathsToProcess.push(pathToModule);
        } else {
          if (packageJson.optionalDependencies && dependency in packageJson.optionalDependencies) {
            return;
          }
          throw new Error(`[serverless-plugin-include-dependencies]: Could not find ${dependency}`);
        }
      });
    }

    if (packageJson.optionalDependencies) {
      Object.keys(packageJson.optionalDependencies).forEach(dependency => {
        const pathToModule = resolvePkg(dependency, {
          cwd: currentModulePath
        });

        if (pathToModule) {
          modulePathsToProcess.push(pathToModule);
        } else {
          serverless.cli.log(`[serverless-plugin-include-dependencies]: missing optional dependency: ${dependency}`);
        }
      });
    }
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
