# serverless-plugin-include-dependencies

This is a Serverless plugin that should make your deployed functions smaller. It does this by excluding `node_modules` then individually adds each module file that your handler depends on.

As of 5.0.0 this plugin uses the `package.patterns` property. `always` is no longer supported as it should be possible with just package.patterns

> Note: This plugin no longer excludes the `aws-sdk` to stay in line with AWS best practices (bring your own SDK)

If you use this plugin, you should disable the built-in Serverless option for excluding development dependencies, which is slower anyway:

```yml
package:
  excludeDevDependencies: false
```

Also consider using `serverless-plugin-common-excludes` for even greater package size reduction, and `serverless-plugin-package-size` to add guards against your deployed functions so that they do not exceed a size limit that you set.

## Installation

First install the plugin via npm.

```
npm install serverless-plugin-include-dependencies --save-dev
```

Then include the plugin within your serverless.yml config.

```yml
plugins:
  - serverless-plugin-include-dependencies
```

## Usage Example

`serverless.yml`
```yaml
service: sample

package:
  patterns:
    - '!node_modules/**' # no need to add this, this plugin does it for you

plugins:
  - serverless-plugin-common-excludes # this should go before serverless-plugin-include-dependencies
  - serverless-plugin-include-dependencies

functions:
  foo:
    handler: src/handler/foo.handler
  bar:
    handler: src/handler/bar.handler
```

For even smaller function packages, you can also set:

```yaml
package:
  individually: true
```
But be warned: Smaller individual functions can still mean a larger overall deployment. (10 functions that are 3 MB each is more net data tranfer and storage than 1 function that is 6 MB)

## Dependency caching (Experimental)

When building a shared bundle for several functions, execution time can be reduced by enabling dependency caching. Caching is disabled by default and can be enabled using the `enableCaching` option:

```yaml
custom:
  includeDependencies:
    enableCaching: true
```

## New In 2.0 - Exclusion Support

Rather than including module folders (e.g. `node_modules/foo/**`, it now includes a list of actual files (e.g. `node_modules/foo/package.json`, `node_modules/foo/index.js`) and *uses the serverless package patterns* to filter these files. Patterns *must* start with `!node_modules` to be considered by this plugin.

The following examples would filter files of your module dependencies:

- `!node_modules/**/README.*`
- `!node_modules/**/test/**`

These would not:

- `!README`
- `!**/*.txt`

Even though normal matching libraries would match these rules, this library ignores them so that there's no chance of local excludes conflicting with node_modules excludes.

Unless you know exactly where dependencies will be installed (e.g. several things could depend on aws-sdk) you probably want a rule more like `!node_modules/**/foo/**` (which will exclude all instances of foo) and not `node_modules/foo/**` (which would only exclude a top-level foo)
