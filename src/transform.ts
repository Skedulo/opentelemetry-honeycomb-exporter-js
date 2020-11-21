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

import { CanonicalCode, SpanKind } from '@opentelemetry/api';
import { randomSpanId } from '@opentelemetry/core';
import { ReadableSpan } from '@opentelemetry/tracing';
import {
  hrTimeToMilliseconds,
} from '@opentelemetry/core';
import { Builder, Event as HoneyEvent } from 'libhoney';

export type EventVisitor = (event: HoneyEvent) => void

// Based on: https://github.com/honeycombio/opentelemetry-exporter-go/blob/c65cc92b8f6e7e26b813944fcf0dd132a63656fd/honeycomb/honeycomb.go#L535
// link represents a link to a trace and span that lives elsewhere.
// TraceID and ParentID are used to identify the span with which the trace is associated
// We are modeling Links for now as child spans rather than properties of the event.
function refsFromSpan(builder: Builder, span: ReadableSpan, delta: number, visitor: EventVisitor) {
  const ctx = span.spanContext
  const traceId = ctx.traceId
  const pSpanId = ctx.spanId
  for (const link of span.links) {
    const lTraceId = link.context.traceId
    const lSpanId = link.context.spanId
    const ref = builder.newEvent()
    ref.add({
      'duration_ms': 0, // present in python, not present in golang
      'trace.trace_id': traceId,
      'trace.parent_id': pSpanId,
      'trace.span_id': randomSpanId(),
      'trace.link.trace_id': lTraceId,
      'trace.link.span_id': lSpanId,
      'meta.span_type': 'link',
			// TODO(ajbouh): properly set the reference type when specs are defined
      // see https://github.com/open-telemetry/opentelemetry-specification/issues/65
      'ref_type': 0,
    })
    if (link.attributes) {
      ref.add(link.attributes)
    }
    visitor(ref)
  }
}

function logsFromSpan(builder: Builder, span: ReadableSpan, delta: number, visitor: EventVisitor) {
  const ctx = span.spanContext
  const traceId = ctx.traceId
  const pSpanId = ctx.spanId
  const pSpanName = span.name
  for (const event of span.events) {
    const l = builder.newEvent()
    l.timestamp = new Date(delta + hrTimeToMilliseconds(event.time))
    l.add({
      'duration_ms': 0, // present in python, not present in golang
      'name': event.name,
      'trace.trace_id': traceId,
      'trace.parent_id': pSpanId,
      'trace.span_id': randomSpanId(),
      'trace.parent_name': pSpanName,
      'meta.span_type': 'span_event',
    })
    if (event.attributes) {
      l.add(event.attributes)
    }
    visitor(l)
  }
}

/**
 * Translate OpenTelemetry ReadableSpan to Honeycomb Event
 * @param span Span to be translated
 */
export function visitTransformedEvents(builder: Builder, span: ReadableSpan, delta: number, visitor: EventVisitor) {
  const ctx = span.spanContext
  const traceId = ctx.traceId
  const spanId = ctx.spanId
  const start_ms = delta + hrTimeToMilliseconds(span.startTime)
  const duration_ms = hrTimeToMilliseconds(span.duration);
  const d = builder.newEvent()

  d.timestamp = new Date(start_ms)
  d.add({
    'trace.trace_id': traceId,
    'trace.parent_id': span.parentSpanId,
    'trace.span_id': spanId,
    'name': span.name,
    'duration_ms': duration_ms,
    
    "status.code": span.status.code, // https://github.com/honeycombio/opentelemetry-exporter-go/blob/c65cc92b8f6e7e26b813944fcf0dd132a63656fd/honeycomb/honeycomb.go#L570
    'response.status_code': span.status.code, // is this right?
    'status.message': span.status.message,
    'span.kind': SpanKind[span.kind],  // meta.span_type?
    'meta.span_type': SpanKind[span.kind],  // is this right?
    // 'has_remote_parent': Present in golang, not present in python?
  })
  // TODO: use sampling_decision attributes for sample rate.
  d.add(span.attributes)

  // Ensure that if Status.Code is not OK, that we set the 'error' tag on the span.
  if (span.status.code !== CanonicalCode.OK) {
    d.addField('error', true)
  }
  refsFromSpan(builder, span, delta, visitor)
  logsFromSpan(builder, span, delta, visitor)
  visitor(d)
}
