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

});
