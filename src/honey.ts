/*!
 * Copyright 2019, OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as api from '@opentelemetry/api';
import { NoopLogger, ExportResult } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/tracing';
import { visitTransformedEvents } from './transform';
import { ExporterConfig } from './types'
import { Libhoney, Builder } from 'libhoney';

/**
 * Format and sends span information to Honeycomb Exporter.
 */
export class HoneycombExporter implements SpanExporter {
  private readonly _logger: api.Logger;
  private readonly _honey: Libhoney;
  private readonly _builder: Builder;
  private readonly _forceFlushOnShutdown: boolean = true;

  constructor(config: ExporterConfig) {
    this._logger = config.logger || new NoopLogger();
    this._forceFlushOnShutdown =
    typeof config.forceFlush === 'boolean' ? config.forceFlush : true;
    
    this._honey = config.libhoney instanceof Libhoney ?
        config.libhoney :
        new Libhoney({
          ...config.libhoney,
          // TODO(ajbouh) consider including responseCallback so we can count and log events as they're flushed
        })
    this._builder = this._honey.newBuilder({
      serviceName: config.serviceName,
    }, {})
  }

  /** Exports a list of spans to Honeycomb. */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    if (spans.length === 0) {
      return resultCallback(ExportResult.SUCCESS);
    }
    this._logger.debug('Honeycomb exporter export');
    this._sendSpans(spans, resultCallback).catch(err => {
      this._logger.error(`Honeycomb failed to export: ${err}`);
    });
  }

  /** Shutdown exporter. */
  shutdown(): void {
    if (!this._forceFlushOnShutdown) return;
    // Make an optimistic flush.
    this.flush();
  }

  /** Transform spans and sends to Honeycomb service. */
  private async _sendSpans(
    spans: ReadableSpan[],
    done?: (result: ExportResult) => void
  ) {
    let total = 0
    for (const span of spans) {
      try {
        visitTransformedEvents(this._builder, span, event => {
          ++total
          event.sendPresampled()
        })
      } catch (err) {
        this._logger.error(`failed to enqueued span: ${err}`);
        // TODO right now we break out on first error, is that desirable?
        if (done) return done(ExportResult.FAILED_NOT_RETRYABLE);
      }
    }
    this._logger.debug('successfully enqueued %s spans and %s additional implicit event(s)', spans.length, total - spans.length);
    
    if (done) return done(ExportResult.SUCCESS);
  }

  async flush(): Promise<void> {
    await this._honey.flush()
    this._logger.debug('successful flush for unknown number of spans',);
  }
}
