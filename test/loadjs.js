/*global loadjs */
"use strict";

var expect = require('expect.js');

describe('loadjs', function() {

  it('should return the exported object from the "a" module', function(done) {
    loadjs(['./a'], function(a) {
      expect(a).to.be('a');
      done();
    });
  });

  it('should load a module with slashes in the ID', function(done) {
    loadjs(['./f/index'], function(f) {
      expect(f).to.be('f');
      done();
    });
  });

  it('should load the dependencies of a module that is already loaded (but not executed yet)', function(done) {
    // first k is loaded and executed. n is in the same file as k.  Then n is
    // loaded, which has a dependency to o, which is in the second file.
    // Even if n is loaded, it should still check and load its dependencies,
    // so the second file will be loaded.
    loadjs(['./k'], function(k) {
      expect(k).to.be('k');
      loadjs(['./n'], function(n) {
        expect(n).to.eql({n: 'n', o: 'o'});
        done();
      });
    });
  });

  it('should call the error function with an error if the module cannot be loaded', function(done) {
    loadjs(['foobar'], function() {
      done(new Error('should not be called'));
    }, function(err) {
      expect(err).to.be.ok();
      done();
    });
  });

  it('should require two modules from the same file at the same time', function(done) {
    var modules = {};
    var l = 0;
    function ready(x) {
      modules[x] = x;
      if (++l == 2) {
        expect(modules).to.eql({p: 'p', q: 'q'});
        done();
      }
    }
    loadjs(['./p'], ready, done);
    loadjs(['./q'], ready, done);
  });

  it('should load two modules from two JS files', function(done) {
    loadjs(['./r', './s'], function(r, s) {
      expect(r).to.be('r');
      expect(s).to.be('s');
      done();
    }, done);
  });

});
