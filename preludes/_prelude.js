"use strict";

var parallel   = require('../lib/parallel');
var loadScript = require('../lib/loadScript');
var fold       = require('../lib/fold');
var append     = require('../lib/append');
var indexOf    = require('../lib/indexOf');

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
        return __require(modules[id].deps[_id]).exports;
      };
      modules[id].def.call(exports, _req, module, exports);
    } else {
      var err = new Error('Cannot find module \'' + id + '\'');
      err.code = 'MODULE_NOT_FOUND';
      module.err = err;
    }
  }
  return module;
}

function __requireAll(ids, fn) {
  fn.apply(null, fold(ids, [[], []], function(id, i, args) {
    var module = __require(id);
    args[module.err ? 0 : 1].push(module.err || module.exports);
    return args;
  }));
}

function defaultErrFn(err) {
  throw err;
}

function noop() {
}

var loading = {};
var loaded = [];

function loadScriptFile(file) {
  loadScript(loadjs.url + file, function(err) {
    var cbs = loading[file];
    if (!err) {
      loading[file] = null;
      loaded.push(file);
    }
    fold(cbs, 0, function(cb) {
      cb(err, file);
    });
  });
}

// it's possible to set those options as a global
var opts = global.loadjs || {};

var loadjs = global.loadjs = function(deps, fn, errFn) {

  if (!fn) fn = noop;
  if (!errFn) errFn = defaultErrFn;

  // and if we need to load external files
  var filesToWatch = fold(deps, [], function(module, key, toWatch) {
    return fold(loadjs.map[module] || [], toWatch, function(fIndex, i, toLoad) {
      var file = loadjs.files[fIndex];
      if (indexOf(loaded, file) == -1) {
        toLoad.push(file);
      }
      return toLoad;
    });
  });

  // files that are not yet loading
  var filesToLoad = fold(filesToWatch, [], function(file, key, files) {
    return loading[file] ? files : append(files, file);
  });

  var loadTasks = fold(filesToWatch, [], function(file, key, tasks) {
    // subscribe to the array of callbacks that is
    // called when the file is loaded
    tasks.push(function(cb) {
      if (loading[file]) loading[file].push(cb);
      else loading[file] = [cb];
    });
    return tasks;
  });

  // when all files are loaded, the modules can be required
  parallel(loadTasks, function() {
    var errors = parallel.errors(arguments);
    if (errors.length) {
      errFn(errors[0]);
    } else {
      __requireAll(deps, function(errors, exports) {
        if (errors.length) errFn(errors[0]);
        else fn.apply(null, exports);
      });
    }
  });

  // trigger loading the files, if necessary
  fold(filesToLoad, 0, loadScriptFile);

};

loadjs.d = __define;

loadjs.url = opts.url || '';
loadjs.files = [];
loadjs.map = {};
