"use strict";

module.exports = arrayToObject;

function arrayToObject(array) {
  var obj = {};
  array.forEach(function(item) {
    obj[item] = item;
  });
  return obj;
}
