'use strict'

const parse = require('./parse')
const { isHtml } = require('./utils')

/**
 * The API
 */
const api = [
  require('./api/attributes'),
  require('./api/traversing'),
  require('./api/manipulation'),
  require('./api/css'),
  require('./api/forms')
]

/**
 * Instance of cheerio
 */
const Cheerio = module.exports = function (selector, context, root, options) {
  if (!(this instanceof Cheerio)) {
    return new Cheerio(selector, context, root, options)
  }

  this.options = Object.assign({}, this.options, options || {})

  // $(), $(null), $(undefined), $(false)
  if (!selector) {
    return this
  }

  if (root) {
    if (typeof root === 'string') {
      root = parse(root, this.options)
    }
    this._root = Cheerio.call(this, root)
  }

  // $($)
  if (selector.cheerio) {
    return selector
  }

  // $(dom)
  if (isNode(selector)) {
    selector = [selector]
  }

  // $([dom])
  if (Array.isArray(selector)) {
    selector.forEach((elem, idx) => {
      this[idx] = elem
    })
    this.length = selector.length
    return this
  }

  // $(<html>)
  if (typeof selector === 'string' && isHtml(selector)) {
    return Cheerio.call(this, parse(selector, this.options).children)
  }

  // If we don't have a context, maybe we have a root, from loading
  if (!context) {
    context = this._root
  } else if (typeof context === 'string') {
    if (isHtml(context)) {
      // $('li', '<ul>...</ul>')
      context = parse(context, this.options)
      context = Cheerio.call(this, context)
    } else {
      // $('li', 'ul')
      selector = [context, selector].join(' ')
      context = this._root
    }
  // $('li', node), $('li', [nodes])
  } else if (!context.cheerio) {
    context = Cheerio.call(this, context)
  }

  // If we still don't have a context, return
  if (!context) {
    return this
  }

  // #id, .class, tag
  return context.find(selector)
}

/**
 * Mix in `static`
 */
Object.assign(Cheerio, require('./static'))

/**
 * Set a signature of the object
 */
Cheerio.prototype.cheerio = '[cheerio object]'

/**
 * Cheerio default options
 */
Cheerio.prototype.options = {
  withDomLvl1: true,
  normalizeWhitespace: false,
  xmlMode: false,
  decodeEntities: true
}

/**
 * Make cheerio an array-like object
 */
Cheerio.prototype.length = 0
Cheerio.prototype.splice = Array.prototype.splice

/**
 * Make a cheerio object
 * @api private
 */
Cheerio.prototype._make = function (dom, context) {
  const cheerio = new this.constructor(dom, context, this._root, this.options)
  cheerio.prevObject = this
  return cheerio
}

/**
 * Turn a cheerio object into an array
 */
Cheerio.prototype.toArray = function () {
  return this.get()
}

/**
 * Plug in the API
 */
api.forEach(mod => Object.assign(Cheerio.prototype, mod))

function isNode(obj) {
  return obj.name || obj.type === 'text' || obj.type === 'comment'
}
