# serverless-plugin-include-dependencies

This is a Serverless plugin that should make your deployed functions smaller.

It does this by enabling you to add your `node_modules` folder to the `exclude` list, then it individually adds each module that your handler depends on.

## Usage Example

`serverless.yml`
```yaml
service: sample

package:
  exclude:
    - node_modules/** # no need to add this yourself, this plugin does it for you

plugins:
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
But be warned: Smaller individual functions can still mean a larger overall package. (10 functions that are 3 MB each is more net data tranfer and storage than 1 function that is 6 MB)
