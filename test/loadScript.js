"use strict";

var expect = require('expect.js');
var loadScript = require('../lib/loadScript');

describe('loadScript', function() {

  it('should load a JS file', function(done) {
    loadScript('./fixtures/loadScript.js', function(err) {
      if (err) return done(err);
      expect(typeof LOAD_SCRIPT).to.be('boolean');
      done();
    });
  });

  it('should return an error when the file was not loaded', function(done) {
    loadScript('./fixtures/notExisting.js', function(err) {
      expect(err).to.be.ok();
      done();
    });
  });

});
