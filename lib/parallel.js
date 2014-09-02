"use strict";

var fold = require('./fold');

module.exports = parallel;

function parallel(array, fn) {

  var length = array.length;
  var results = new Array(length);
  var loaded = 0;

  function wrap(fn, index) {
    fn(function callback(err) {
      results[index] = arguments;
      loaded++;
      ready();
    });
  }

  function ready() {
    if (loaded >= length) {
      fn.apply(null, results);
    }
  }

  ready();

  fold(array, 0, wrap);

}

parallel.errors = function errors(args) {
  return fold(args, [], function(val, key, errors) {
    if (val[0]) errors.push(val[0]);
    return errors;
  });
};
