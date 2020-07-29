# OpenTelemetry Honeycomb Trace Exporter
[![Apache License][license-image]][license-image]

OpenTelemetry Honeycomb Trace Exporter allows the user to send collected traces to Honeycomb.

## Installation

```bash
npm install --save https://github.com/metered/opentelemetry-honeycomb-exporter-js
```

## Usage

Install the exporter on your application and pass the options, it must contain a service name.

```js
import { HoneycombExporter } from '@honeycombio/opentelemetry-exporter';

const exporter = new HoneycombExporter({
  logger: console,
  serviceName: "my-service",
  libhoney: {
    writeKey: 'honeycomb-api-key',
    dataset: 'my-dataset',
  }
})
```

Now, register the exporter.

```js
tracer.addSpanProcessor(new BatchSpanProcessor(exporter));
```

You can use built-in `SimpleSpanProcessor` or `BatchSpanProcessor` or write your own.

- [SimpleSpanProcessor](https://github.com/open-telemetry/opentelemetry-specification/blob/master/specification/sdk-tracing.md#simple-processor): The implementation of `SpanProcessor` that passes ended span directly to the configured `SpanExporter`.
- [BatchSpanProcessor](https://github.com/open-telemetry/opentelemetry-specification/blob/master/specification/sdk-tracing.md#batching-processor): The implementation of the `SpanProcessor` that batches ended spans and pushes them to the configured `SpanExporter`. It is recommended to use this `SpanProcessor` for better performance and optimization.


## Useful links
- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For help or feedback on this project, join us on [gitter][gitter-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[license-url]: https://github.com/open-telemetry/opentelemetry-js/blob/master/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
