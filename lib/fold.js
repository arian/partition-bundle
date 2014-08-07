"use strict";

module.exports = fold;

function fold(array, acc, fn, ctx) {
  for (var i = 0; i < array.length; i++) {
    acc = fn.call(ctx, array[i], i, acc);
  }
  return acc;
}

