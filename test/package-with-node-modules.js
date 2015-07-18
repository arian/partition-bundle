"use strict";

var expect = require('expect.js');

var fs = require('fs');
var vm = require('vm');
var browserify = require('browserify');

var partition = require('../index');

describe('packages from node_modules', function() {

  it('should require modules from node_modules', function(done) {

    var dist = __dirname + '/../dist/package-with-node-modules';

    browserify()
      .plugin(partition, {
        map: __dirname + '/fixtures/package-with-node-modules/bundle.json',
        output: dist
      })
      .bundle(function(err) {

        var libjs = fs.readFileSync(dist + '/lib.js', 'utf8');
        var appjs = fs.readFileSync(dist + '/app.js', 'utf8');

        expect(libjs).to.contain('mylib');
        expect(libjs).to.contain('hislib');

        var sandbox = vm.createContext({});
        sandbox.global = sandbox;
        vm.runInContext(appjs, sandbox);

        expect(Object.keys(sandbox.loadjs.map).sort()).to.eql([
          './index',
          'hislib',
          'mylib'
        ]);

        done();
      });

  });

});
