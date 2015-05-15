"use strict";

var expect = require('expect.js');
var browserify = require('browserify');
var fs = require('fs');
var partition = require('../index');

describe('browser field in package.json', function() {

  it('should require modules from the browser field in the package.json', function(done) {

    var dist = __dirname + '/../dist/package-with-browser';

    browserify()
      .plugin(partition, {
        map: __dirname + '/fixtures/package-with-browser/bundle.json',
        output: dist
      })
      .bundle(function(err) {

        var content = fs.readFileSync(dist + '/lib.js', 'utf8');

        expect(content).to.contain('mylib');
        expect(content).to.contain('hislib');

        done();
      });

  });

});
