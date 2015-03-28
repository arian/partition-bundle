"use strict";

var forOwn = require('./forOwn');
var arrayToObject = require('./arrayToObject');

function partitioner(map, firstFile) {

  var modulesByID = {};
  var moduleBelongsTo = {};

  // register the module
  function addModule(row) {
    modulesByID[row.id] = row;
    moduleBelongsTo[row.id] = {};
  }

  // search through the dependencies recursively, and associate each dependency
  // to a target file
  function depsBelongTo(deps, file, topLevel) {
    forOwn(deps, function(dep) {
      dep = modulesByID[dep];
      var belong = moduleBelongsTo[dep.id];
      var count = belong[file] = topLevel ? Infinity : (belong[file] || 0) + 1;
      // stop at 3, otherwise it might be a cyclic dependency
      if (count <= 3 || topLevel) depsBelongTo(dep.deps, file);
    });
  }

  function partition() {
    var first = 0;
    var files = [];
    forOwn(map, function(_deps, file) {
      if (first++ === 0) firstFile = file;
      // top level dependencies, they get the highest 'count', so the map
      // dictates where that module goes.
      depsBelongTo(arrayToObject(_deps), file, true);
      files.push(file);
    });

    if (files.indexOf(firstFile) == -1) {
      files.unshift(firstFile);
    }

    forOwn(moduleBelongsTo, function(files, id) {
      // determine which file claims the module the most. If it's a dangling
      // file, it's automatically added to the 'main.js'
      var file = firstFile;
      var count = 0;
      for (var f in files) if (f == firstFile || files[f] > count){
        file = f;
        count = files[f];
        // even though a module really belongs to another file, but is
        // required by the main file, it should be in the main file.
        // This solves immediate loading of a second file in the browser
        if (f == firstFile) break;
      }
      // assign the destination file
      modulesByID[id].destFile = file;
    });
    return {
      modulesByID: modulesByID,
      firstFile: firstFile,
      files: files
    };
  }

  return {
    addModule: addModule,
    partition: partition
  };
}

module.exports = partitioner;
