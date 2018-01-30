'use strict'

const serialize = require('dom-serializer')
const select = require('css-select')
const parse = require('./parse')

/**
 * $.load(str)
 */
exports.load = function (content, options) {
  const Cheerio = require('./cheerio')
  options = Object.assign({}, Cheerio.prototype.options, options || {})
  const root = parse(content, options)

  function initialize(selector, context, r, opts) {
    if (!(this instanceof initialize)) {
      // eslint-disable-next-line new-cap
      return new initialize(selector, context, r, opts)
    }
    opts = Object.assign({}, options, opts || {})
    return Cheerio.call(this, selector, context, r || root, opts)
  }

  // Ensure that selections created by the "loaded" `initialize` function are
  // true Cheerio instances.
  initialize.prototype = Object.create(Cheerio.prototype)
  initialize.prototype.constructor = initialize

  // Mimic jQuery's prototype alias for plugin authors.
  initialize.fn = initialize.prototype

  // Keep a reference to the top-level scope so we can chain methods that
  // implicitly resolve selectors; e.g. $("<span>").(".bar"), which otherwise
  // loses ._root
  initialize.prototype._originalRoot = root

  // Add in the static methods
  Object.assign(initialize, exports)

  // Add in the root
  initialize._root = root
  // store options
  initialize._options = options

  return initialize
}

/**
 * Helper function
 */
function render(that, dom, options) {
  if (!dom) {
    if (that._root && that._root.children) {
      dom = that._root.children
    } else {
      return ''
    }
  } else if (typeof dom === 'string') {
    dom = select(dom, that._root, options)
  }

  return serialize(dom, options)
}

/**
 * $.html([selector | dom], [options])
 */
exports.html = function (dom, options) {
  const Cheerio = require('./cheerio')

  // be flexible about parameters, sometimes we call html(),
  // with options as only parameter
  // check dom argument for dom element specific properties
  // assume there is no 'length' or 'type' properties in the options object
  if (
    Object.prototype.toString.call(dom) === '[object Object]' &&
    !options &&
    !('length' in dom) &&
    !('type' in dom)
  ) {
    options = dom
    dom = undefined
  }

  // Sometimes $.html() used without preloading html so fallback non existing
  // options to the default ones.
  options = Object.assign(
    {},
    this._options,
    Cheerio.prototype.options,
    this._options,
    options || {}
  )

  return render(this, dom, options)
}

/**
 * $.xml([selector | dom])
 */
exports.xml = function (dom) {
  const options = Object.assign({}, this._options, {
    xmlMode: true
  })

  return render(this, dom, options)
}

/**
 * $.text(dom)
 */
exports.text = function (elems = this.root()) {
  let ret = ''

  for (let i = 0; i < elems.length; i++) {
    const elem = elems[i]
    if (elem.type === 'text') {
      ret += elem.data
    } else if (elem.children && elem.type !== 'comment' && elem.tagName !== 'script' && elem.tagName !== 'style') {
      ret += exports.text(elem.children)
    }
  }

  return ret
}

/**
 * $.parseHTML(data [, context ] [, keepScripts ])
 * Parses a string into an array of DOM nodes. The `context` argument has no
 * meaning for Cheerio, but it is maintained for API compatibility with jQuery.
 */
exports.parseHTML = function (data, context, keepScripts) {
  if (!data || typeof data !== 'string') {
    return null
  }

  if (typeof context === 'boolean') {
    keepScripts = context
  }

  const parsed = this.load(data)
  if (!keepScripts) {
    parsed('script').remove()
  }

  // The `children` array is used by Cheerio internally to group elements that
  // share the same parents. When nodes created through `parseHTML` are
  // inserted into previously-existing DOM structures, they will be removed
  // from the `children` array. The results of `parseHTML` should remain
  // constant across these operations, so a shallow copy should be returned.
  return parsed.root()[0].children.slice()
}

/**
 * $.root()
 */
exports.root = function () {
  return this(this._root)
}

/**
 * $.contains()
 */
exports.contains = function (container, contained) {
  // According to the jQuery API, an element does not "contain" itself
  if (contained === container) {
    return false
  }

  // Step up the descendants, stopping when the root element is reached
  // (signaled by `.parent` returning a reference to the same object)
  while (contained && contained !== contained.parent) {
    contained = contained.parent
    if (contained === container) {
      return true
    }
  }

  return false
}

/**
 * $.merge()
 */
exports.merge = function (arr1, arr2) {
  if (!(isArrayLike(arr1) && isArrayLike(arr2))) {
    return
  }

  const newLength = arr1.length + arr2.length
  let i = 0

  while (i < arr2.length) {
    arr1[i + arr1.length] = arr2[i]
    i++
  }

  arr1.length = newLength
  return arr1
}

function isArrayLike(item) {
  if (Array.isArray(item)) {
    return true
  }

  if (typeof item !== 'object') {
    return false
  }

  if (!item.hasOwnProperty('length')) {
    return false
  }

  if (typeof item.length !== 'number') {
    return false
  }

  if (item.length < 0) {
    return false
  }

  let i = 0
  while (i < item.length) {
    if (!(i in item)) {
      return false
    }
    i++
  }
  return true
}
