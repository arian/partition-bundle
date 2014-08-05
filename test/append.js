"use strict";

var expect = require('expect.js');
var append = require('../lib/append');

describe('append', function() {

  it('should add a new item to the array', function() {
    var a = append([1, 2], 3);
    expect(a).to.eql([1, 2, 3]);
    var b = append([1, 2, 3], 3);
    expect(b).to.eql([1, 2, 3]);
  });

});
