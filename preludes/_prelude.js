"use strict";

var parallel   = require('../lib/parallel');
var loadScript = require('../lib/loadScript');
var fold       = require('../lib/fold');
var append     = require('../lib/append');

var cache = {};
var modules = {};

function __define(id, def, deps) {
  modules[id] = {def: def, deps: deps};
}

function __require(id) {
  var module = cache[id];
  if (!module) {
    module = cache[id] = {};
    var exports = module.exports = {};
    if (modules[id]) {
      var _req = function(_id) {
        return __require(modules[id].deps[_id]);
      };
      modules[id].def.call(exports, _req, module, exports);
    } else {
      var err = new Error('Cannot find module \'' + id + '\'');
      err.code = 'MODULE_NOT_FOUND';
      throw err;
    }
  }
  return module.exports;
}

function __requireAll(ids, fn) {
  fn.apply(null, fold(ids, [], function(id, i, exports) {
    exports.push(__require(id));
    return exports;
  }));
}

var loaded = [];

var loadjs = global.loadjs = function(deps, fn) {

  // find modules that are not loaded yet
  var modulesToLoad = fold(deps, [], function(module, key, acc) {
    return (modules[module]) ? acc : append(acc, module);
  });

  // and if we need to load external files
  var filesToLoad = fold(modulesToLoad, [], function(module, key, toLoad) {
    return fold(loadjs.map[module] || [], toLoad, function(fIndex, i, toLoad) {
      return append(toLoad, loadjs.files[fIndex]);
    });
  });

  // map to tasks that load the external file
  var loadTasks = fold(filesToLoad, [], function(file, key, tasks) {
    tasks.push(function(cb) {
      loadScript(loadjs.url + file, cb);
    });
    return tasks;
  });

  // execute tasks to load external files
  parallel(loadTasks, function() {
    fold(parallel.errors(arguments), null, function(err) {
      // throw error, but don't block the execution
      setTimeout(function() {
        throw err;
      }, 0);
    });
    __requireAll(deps, fn);
  });

};


loadjs.d = __define;

loadjs.url = '';
loadjs.files = [];
loadjs.map = {};
