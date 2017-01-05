'use strict';

const path = require('path');

const precinct = require('precinct');
const resolve = require('resolve');
const findRoot = require('find-root');

module.exports = function(filename, serverless) {
  const base = path.dirname(filename);
  const dependencies = {};

  const modules = {};
  const filesToProcess = [filename];

  while (filesToProcess.length) {
    const current = filesToProcess.pop();

    if (current in dependencies) {
      continue;
    }

    precinct.paperwork(current).forEach(name => {
      const abs = resolve.sync(name, {
        basedir: path.dirname(current)
      });
      const rel = path.relative(base, abs);

      // found a module dependency
      if (rel.match('node_modules')) {
        const directory = path.dirname(abs);
        const root = findRoot(directory);

        modules[root] = true;
      } else {
        if (resolve.isCore(name)) {
          return;
        }
        // found a local file, continue to run precinct on it
        filesToProcess.push(abs);
      }
    });

    dependencies[current] = current;
  }

  const moduleToProcess = Object.keys(modules);

  while (moduleToProcess.length) {
    const current = moduleToProcess.pop();

    if (current in dependencies) {
      continue;
    }

    const pkg = require(path.join(current, 'package.json'));

    if (pkg.dependencies) {
      Object.keys(pkg.dependencies).forEach(dependency => {
        const abs = resolve.sync(dependency, {
          basedir: current
        });

        const directory = path.dirname(abs);
        const root = findRoot(directory);

        moduleToProcess.push(root);
      });
    }

    if (pkg.optionalDependencies) {
      Object.keys(pkg.optionalDependencies).forEach(dependency => {
        try {
          const abs = resolve.sync(dependency, {
            basedir: current
          });

          const directory = path.dirname(abs);
          const root = findRoot(directory);

          moduleToProcess.push(root);
        } catch (e) {
          serverless.cli.log(`[serverless-plugin-include-dependencies]: missing optional dependency: ${dependency}`);
        }
      });
    }

    dependencies[current] = path.join(current, '**');
  }

  return Object.keys(dependencies).map(k => dependencies[k]);
};
