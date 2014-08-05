"use strict";

module.exports = append;

function append(array, item) {
  if (array.indexOf(item) == -1) {
    array.push(item);
  }
  return array;
}
