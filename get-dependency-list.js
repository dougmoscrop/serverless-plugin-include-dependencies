'use strict';

const path = require('path');

const precinct = require('precinct');
const resolve = require('resolve');
const resolvePkg = require('resolve-pkg');

module.exports = function(filename, serverless) {
  const base = path.dirname(filename);
  const dependencies = {};

  const modules = new Set();
  const filesToProcess = [filename];

  while (filesToProcess.length) {
    const current = filesToProcess.pop();

    if (current in dependencies) {
      continue;
    }

    precinct.paperwork(current).forEach(name => {
      if (resolve.isCore(name)) {
        return;
      }

      if (name.indexOf('.') === 0) {
        const abs = resolve.sync(name, {
          basedir: path.dirname(current)
        });
        filesToProcess.push(abs);
      } else {
        const path = resolvePkg(name, {
          cwd: base
        });

        if (path) {
          modules.add(path);
        } else {
          throw new Error(`[serverless-plugin-include-dependencies]: Could not find ${name}`);
        }
      }
    });

    dependencies[current] = current;
  }

  const moduleToProcess = Array.from(modules);

  while (moduleToProcess.length) {
    const current = moduleToProcess.pop();

    if (current in dependencies) {
      continue;
    }

    dependencies[current] = path.join(current, '**');

    const pkg = require(path.join(current, 'package.json'));

    if (pkg.dependencies) {
      Object.keys(pkg.dependencies).forEach(dependency => {
        const pkg = resolvePkg(dependency, {
          cwd: current
        });

        if (pkg) {
          moduleToProcess.push(pkg);
        } else {
          throw new Error(`[serverless-plugin-include-dependencies]: Could not find ${dependency}`);
        }
      });
    }

    if (pkg.optionalDependencies) {
      Object.keys(pkg.optionalDependencies).forEach(dependency => {
        const pkg = resolvePkg(dependency, {
          cwd: current
        });

        if (pkg) {
          moduleToProcess.push(pkg);
        } else {
          serverless.cli.log(`[serverless-plugin-include-dependencies]: missing optional dependency: ${dependency}`);
        }
      });
    }
  }

  return Object.keys(dependencies).map(k => dependencies[k]);
};
