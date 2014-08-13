"use strict";

var expect = require('expect.js');
var indexOf = require('../lib/indexOf');

describe('indexOf', function() {

  it('should return the index of an item in the array', function() {
    expect(indexOf([1, 2, 3], 1)).to.be(0);
    expect(indexOf([1, 2, 3], 2)).to.be(1);
    expect(indexOf([1, 2, 3], 3)).to.be(2);
  });

  it('should return -1 if the item is not in the array', function() {
    expect(indexOf([1, 2, 3], 4)).to.be(-1);
  });

});
