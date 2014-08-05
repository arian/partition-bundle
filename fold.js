"use strict";

module.exports = fold;

function fold(array, init, fn, ctx) {
  for (var i = 0; i < array.length; i++) {
    init = fn.call(ctx, array[i], i, init);
  }
  return init;
}

