import type { AnyNode, Element } from 'domhandler';
import type { Cheerio } from '../cheerio.js';
import type { prop } from './attributes.js';

type ExtractDescriptorFn = (
  el: Element,
  key: string,
  // TODO: This could be typed with ExtractedMap
  obj: Record<string, unknown>
) => unknown;

interface ExtractDescriptor {
  selector: string;
  out?: string | ExtractDescriptorFn | ExtractMap;
}

type ExtractValue = string | ExtractDescriptor | [string | ExtractDescriptor];

export interface ExtractMap {
  [key: string]: ExtractValue;
}

type ExtractedValue<V extends ExtractValue, M extends ExtractMap> = V extends [
  string | ExtractDescriptor
]
  ? ExtractedValue<V[0], M>
  : V extends string
  ? string
  : V extends ExtractDescriptor
  ? V['out'] extends ExtractMap
    ? ExtractedMap<V['out']>
    : V['out'] extends ExtractDescriptorFn
    ? ReturnType<V['out']>
    : ReturnType<typeof prop>
  : never;

export type ExtractedMap<M extends ExtractMap> = {
  [key in keyof M]: ExtractedValue<M[key], M> | undefined;
};

function getExtractDescr(
  descr: string | ExtractDescriptor
): Required<ExtractDescriptor> {
  if (typeof descr === 'string') {
    return { selector: descr, out: 'textContent' };
  }

  return {
    selector: descr.selector,
    out: descr.out ?? 'textContent',
  };
}

/**
 * Extract multiple values from a document, and store them in an object.
 *
 * @param map - An object containing key-value pairs. The keys are the names of
 *   the properties to be created on the object, and the values are the
 *   selectors to be used to extract the values.
 * @returns An object containing the extracted values.
 */
export function extract<M extends ExtractMap, T extends AnyNode>(
  this: Cheerio<T>,
  map: M
): ExtractedMap<M> {
  const ret: Record<string, unknown> = {};

  for (const key in map) {
    const descr = map[key];
    const isArray = Array.isArray(descr);

    const { selector, out: prop } = getExtractDescr(isArray ? descr[0] : descr);

    const fn: ExtractDescriptorFn =
      typeof prop === 'function'
        ? prop
        : typeof prop === 'string'
        ? (el: Element) => this._make(el).prop(prop)
        : (el: Element) => this._make(el).extract(prop);

    // TODO: Limit to one element
    const $ = this.find(selector);
    ret[key] = isArray
      ? $.map((_, el) => fn(el, key, ret)).get()
      : fn($[0], key, ret);
  }

  return ret as ExtractedMap<M>;
}
