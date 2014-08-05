"use strict";

var expect = require('expect.js');
var parallel = require('../lib/parallel');

function toArray(args) {
  return Array.prototype.slice.call(args);
}

describe('parallel', function() {

  it('should be done when all callbacks are finished', function(done) {
    parallel([
      function(cb) {
        setTimeout(function() {
          cb(null, 'a');
        }, 10);
      },
      function(cb) {
        setTimeout(function() {
          cb(null, 'b');
        }, 10);
      },
      function(cb) {
        setTimeout(function() {
          cb(null, 'c');
        }, 10);
      }
    ], function(a, b, c) {
      expect(toArray(a)).to.eql([null, 'a']);
      expect(toArray(b)).to.eql([null, 'b']);
      expect(toArray(c)).to.eql([null, 'c']);
      done();
    });
  });

});

describe('parallel.errors', function() {

  it('should return an array of the arguments where an error was the first argument', function(done) {
    parallel([
      function(cb) {
        setTimeout(function() {
          cb(null, 'a');
        }, 10);
      },
      function(cb) {
        setTimeout(function() {
          cb('error 1');
        }, 10);
      },
      function(cb) {
        setTimeout(function() {
          cb('error 2');
        }, 10);
      }
    ], function() {
      var errors = parallel.errors(arguments);
      expect(errors).to.eql(['error 1', 'error 2']);
      done();
    });
  });

});
