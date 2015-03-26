(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var indexOf = require('./indexOf');

module.exports = append;

function append(array, item) {
  if (indexOf(array, item) == -1) {
    array.push(item);
  }
  return array;
}

},{"./indexOf":3}],2:[function(require,module,exports){
"use strict";

module.exports = fold;

function fold(array, acc, fn, ctx) {
  for (var i = 0; i < array.length; i++) {
    acc = fn.call(ctx, array[i], i, acc);
  }
  return acc;
}


},{}],3:[function(require,module,exports){
"use strict";

module.exports = indexOf;

function indexOf(array, item) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] === item) return i;
  }
  return -1;
}

},{}],4:[function(require,module,exports){
"use strict";

module.exports = loadScript;

function loadScript(file, head, fn) {
  if (typeof head == 'function') {
    fn = head;
    head = document.getElementsByTagName('head')[0];
  }

  var script = document.createElement('script');
  var done = false;
  var timer;

  function ready(err) {
    done = true;
    script.onload = script.onerror = script.onreadystatechange = null;
    clearTimeout(timer);
    fn(err);
  }

  script.onload = script.onreadystatechange = function(e) {
    if (!done && (!this.readyState || this.readyState == 'complete' || this.readyState == 'loaded')) {
      ready(null);
    }
  };

  script.onerror = function(error) {
    if (!done) {
      ready(error || new Error('Could not load file'));
    }
  };

  timer = setTimeout(function() {
    ready(new Error('Script loading timed-out'));
  }, 3e4);

  script.src = file;
  head.appendChild(script);

}

},{}],5:[function(require,module,exports){
"use strict";

var fold = require('./fold');

module.exports = parallel;

function parallel(array, fn) {

  var length = array.length;
  var results = new Array(length);
  var loaded = 0;

  function wrap(fn, index) {
    fn(function callback(err) {
      results[index] = arguments;
      loaded++;
      ready();
    });
  }

  function ready() {
    if (loaded >= length) {
      fn.apply(null, results);
    }
  }

  ready();

  fold(array, 0, wrap);

}

parallel.errors = function errors(args) {
  return fold(args, [], function(val, key, errors) {
    if (val[0]) errors.push(val[0]);
    return errors;
  });
};

},{"./fold":2}],6:[function(require,module,exports){
(function (global){
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../lib/append":1,"../lib/fold":2,"../lib/indexOf":3,"../lib/loadScript":4,"../lib/parallel":5}]},{},[6]);
