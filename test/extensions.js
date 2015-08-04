"use strict";

var expect = require('expect.js');

var fs = require('fs');
var browserify = require('browserify');

var partition = require('../index');

describe('should load a file with custom extension', function() {

  it('should require modules from the browser field in the package.json', function(done) {

    var dist = __dirname + '/../dist/extensions';

    browserify({
      extensions: ['.jsx']
    })
      .plugin(partition, {
        map: __dirname + '/fixtures/extensions/bundle.json',
        output: dist
      })
      .bundle(function(err) {

        var bundle = fs.readFileSync(dist + '/bundle.js', 'utf8');
        expect(bundle).to.contain('bundle-with-jsx');

        done();
      });

  });

});

