"use strict";

var expect = require('expect.js');
var fold = require('../lib/fold');

describe('fold', function() {

  it('should fold the array into one value', function() {
    var res = fold([1, 2, 3], 0, function(val, key, acc) {
      return acc + val;
    });
    expect(res).to.be(6);
  });

});
