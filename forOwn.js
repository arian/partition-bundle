"use strict";

module.exports = forOwn;

function forOwn(obj, fn, ctx) {
  Object.keys(obj).forEach(function(key) {
    fn.call(this, obj[key], key);
  }, ctx);
}
