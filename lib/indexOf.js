"use strict";

module.exports = indexOf;

function indexOf(array, item) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] === item) return i;
  }
  return -1;
}
