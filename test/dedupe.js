"use strict";

var expect = require('expect.js');

var fs = require('fs');
var vm = require('vm');
var browserify = require('browserify');

var partition = require('../index');

describe('dedupe module', function() {

  it('should put deduped modules in the same file', function(done) {

    var dist = __dirname + '/../dist/dedupe-2';

    browserify()
      .plugin(partition, {
        map: __dirname + '/fixtures/dedupe-2/bundle.json',
        output: dist
      })
      .bundle(function(err) {

        var ajs = fs.readFileSync(dist + '/a.js', 'utf8');

        var sandbox = vm.createContext({});
        sandbox.global = sandbox;
        vm.runInContext(ajs, sandbox);

        expect(sandbox.loadjs.map).to.eql({
          './a/x': [], './b/x': [], './b/y': [1]
        });

        done();
      });

  });

});
