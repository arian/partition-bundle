"use strict";

var expect = require('expect.js');
var forOwn = require('../lib/forOwn');

describe('forOwn', function() {

  it('should iterate over object values', function() {
    var keys = [];
    var vals = [];

    forOwn({a: 1, b: 2, c: 3}, function(val, key) {
      keys.push(key);
      vals.push(val);
    });

    expect(keys).to.eql(['a', 'b', 'c']);
    expect(vals).to.eql([1, 2, 3]);
  });

});
