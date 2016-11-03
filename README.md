# serverless-plugin-include-dependencies

This is a Serverless plugin that should make your deployed functions smaller.

It does this by enabling you to add your `node_modules` folder to the `exclude` list, then it individually adds each *actual file* that your handler depends on.

## Usage Example

`serverless.yml`
```yaml
service: sample

package:
  exclude:
    - node_modules/** # add this yourself

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
