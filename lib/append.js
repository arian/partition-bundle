"use strict";

var indexOf = require('./indexOf');

module.exports = append;

function append(array, item) {
  if (indexOf(array, item) == -1) {
    array.push(item);
  }
  return array;
}
