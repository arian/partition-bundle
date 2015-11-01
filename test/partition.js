"use strict";

var expect = require('expect.js');
var partition = require('../lib/partition');

function destFiles(modules) {
  return Object.keys(modules).reduce(function(dests, id) {
    dests[id] = modules[id].destFile;
    return dests;
  }, {});
}

describe('partition', function() {

  it('should partition a single module to the main file', function() {
    var partitioner = partition({}, 'main.js');
    partitioner.addModule({id: 'a', deps: {}});
    var partitioned = partitioner.partition();
    expect(destFiles(partitioned.modulesByID)).to.eql({
      'a': 'main.js'
    });
  });

  it('should put to unrelated files to separate destFiles according to the map', function() {
    var partitioner = partition({
      'x.js': ['a'],
      'y.js': ['b']
    }, 'main.js');
    partitioner.addModule({id: 'a', deps: {}});
    partitioner.addModule({id: 'b', deps: {}});
    var partitioned = partitioner.partition();
    expect(destFiles(partitioned.modulesByID)).to.eql({
      'a': 'x.js',
      'b': 'y.js'
    });
  });

  it('should put a dependency together with the dependent module', function() {
    var partitioner = partition({
      'x.js': ['a'],
      'y.js': ['b']
    }, 'main.js');
    partitioner.addModule({id: 'a', deps: {}});
    partitioner.addModule({id: 'b', deps: {'./c': 'c'}});
    partitioner.addModule({id: 'c', deps: {}});
    var partitioned = partitioner.partition();
    expect(destFiles(partitioned.modulesByID)).to.eql({
      'a': 'x.js',
      'b': 'y.js',
      'c': 'y.js'
    });
  });

  it('should put shared dependencies in the main file', function() {
    var partitioner = partition({
      'x.js': ['a'],
      'y.js': ['b']
    }, 'main.js');
    partitioner.addModule({id: 'a', deps: {'./c': 'c'}});
    partitioner.addModule({id: 'b', deps: {'./c': 'c'}});
    partitioner.addModule({id: 'c', deps: {}});
    var partitioned = partitioner.partition();
    expect(destFiles(partitioned.modulesByID)).to.eql({
      'a': 'x.js',
      'b': 'y.js',
      'c': 'x.js'
    });
  });

  it('should put second order shared dependency in the common file', function() {
    var partitioner = partition({
      'index.js': ['index'],
      'a.js': ['a'],
      'b.js': ['b']
    }, 'index.js');
    // a -> c -> e
    // b -> d -> e
    partitioner.addModule({id: 'index'});
    partitioner.addModule({id: 'a', deps: {'./c': 'c'}});
    partitioner.addModule({id: 'b', deps: {'./d': 'd'}});
    partitioner.addModule({id: 'c', deps: {'./e': 'e'}});
    partitioner.addModule({id: 'd', deps: {'./e': 'e'}});
    partitioner.addModule({id: 'e'});
    var partitioned = partitioner.partition();
    expect(destFiles(partitioned.modulesByID)).to.eql({
      'a': 'a.js',
      'c': 'a.js',
      'b': 'b.js',
      'd': 'b.js',
      'index': 'index.js',
      'e': 'index.js'
    });
  });

  it('should put a module in the file where most dependent modules are', function() {
    var partitioner = partition({
      'x.js': ['a'],
      'y.js': ['b'],
      'z.js': ['c', 'd']
    }, 'main.js');
    partitioner.addModule({id: 'a', deps: {}});
    partitioner.addModule({id: 'b', deps: {'./e': 'e'}});
    partitioner.addModule({id: 'c', deps: {'./e': 'e'}});
    partitioner.addModule({id: 'd', deps: {'./e': 'e'}});
    partitioner.addModule({id: 'e', deps: {}});
    var partitioned = partitioner.partition();
    expect(destFiles(partitioned.modulesByID)).to.eql({
      'a': 'x.js',
      'b': 'y.js',
      'c': 'z.js',
      'd': 'z.js',
      'e': 'z.js'
    });
  });

  it('should give precedence to what the map dictates', function() {
    var partitioner = partition({
      'x.js': ['a'],
      'y.js': ['b', 'c'],
      'z.js': ['d']
    }, 'main.js');
    partitioner.addModule({id: 'a', deps: {}});
    partitioner.addModule({id: 'b', deps: {}});
    partitioner.addModule({id: 'c', deps: {}});
    partitioner.addModule({id: 'd', deps: {'./e': 'e', './c': 'c'}});
    partitioner.addModule({id: 'e', deps: {'./c': 'c'}});
    var partitioned = partitioner.partition();
    expect(destFiles(partitioned.modulesByID)).to.eql({
      'a': 'x.js',
      'b': 'y.js',
      'c': 'y.js',
      'd': 'z.js',
      'e': 'z.js'
    });
  });

});
