"use strict";

var forOwn = require('./forOwn');
var arrayToObject = require('./arrayToObject');

function partitioner(map, firstFile) {

  var modulesByID = {};
  var modulesBelongsToFileCount = {};
  var inFirstFile = {};

  // register the module
  function addModule(row) {
    modulesByID[row.id] = row;
    modulesBelongsToFileCount[row.id] = {};
  }

  // search through the dependencies recursively, and associate each dependency
  // to a target file
  function depsBelongTo(deps, path, file, isInFirstFile, topLevel) {
    forOwn(deps, function(dep) {
      dep = modulesByID[dep];
      var id = dep.dedupe || dep.id;
      var belongsToFileCount = modulesBelongsToFileCount[id];
      // this module should be in the main.js
      if (isInFirstFile) {
        inFirstFile[id] = true;
      }
      // only when this module was not traversed from the src parent module
      if (path.indexOf(id) === -1) {
        belongsToFileCount[file] = topLevel ? Infinity : ((belongsToFileCount[file] || 0) + 1);
        path = path.slice();
        path.push(id);
        depsBelongTo(dep.deps, path, file, isInFirstFile);
      }
    });
  }

  function partition() {
    var first = 0;
    var files = [];

    forOwn(map, function(_deps, file) {
      if (first++ === 0) firstFile = file;
      // top level dependencies, they get the highest 'count', so the map
      // dictates where that module goes.
      depsBelongTo(arrayToObject(_deps), [], file, file === firstFile, true);
      files.push(file);
    });

    if (files.indexOf(firstFile) == -1) {
      files.unshift(firstFile);
    }

    forOwn(modulesBelongsToFileCount, function(filesCount, id) {
      // determine which file claims the module the most. If it's a dangling
      // file, it's automatically added to the 'main.js'

      var file = firstFile;
      var count = 0;

      Object.keys(filesCount).some(function(f) {
        var localCount = filesCount[f];

        // even though a module really belongs to another file, but is
        // required by the main file, it should be in the main file.
        // This solves immediate loading of a second file in the browser
        if (inFirstFile[id]) {
          file = firstFile;
          return true;
        }

        if (localCount > count) {
          file = f;
          count = localCount;
        }
      });

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
