(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

module.exports = append;

function append(array, item) {
  if (array.indexOf(item) == -1) {
    array.push(item);
  }
  return array;
}

},{}],2:[function(require,module,exports){
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

module.exports = loadScript;

function loadScript(file, head, fn) {
  if (typeof head == 'function') {
    fn = head;
    head = document.getElementsByTagName('head')[0];
  }

  var script = document.createElement('script');
  var done = false;

  function ready(err) {
      done = true;
      script.onload = script.onerror = script.onreadystatechange = null;
      fn(err);
  }

  script.onload = script.onreadystatechange = function() {
    if (!done && (!this.readyState || this.readyState == 'loaded')) {
      ready(null);
    }
  };

  script.onerror = function(error) {
    if (!done) {
      ready(error || new Error('Could not load file'));
    }
  };

  script.src = file;
  head.appendChild(script);

}

},{}],4:[function(require,module,exports){
"use strict";

var fold = require('./fold');

module.exports = parallel;

function parallel(array, fn) {

  var length = array.length;
  var results = new Array(length);
  var loaded = 0;

  function wrap(fn, index) {
    setTimeout(function() {
      fn(function callback(err) {
        results[index] = arguments;
        loaded++;
        ready();
      });
    }, 0);
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

},{"./fold":2}],5:[function(require,module,exports){
(function (global){
"use strict";

var parallel   = require('../lib/parallel');
var loadScript = require('../lib/loadScript');
var fold       = require('../lib/fold');
var append     = require('../lib/append');

var cache = {};
var modules = {};

global.__define = __define;
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
  fn(fold(ids, [], function(id, i, exports) {
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

loadjs.url = '';
loadjs.files = [];
loadjs.map = {};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../lib/append":1,"../lib/fold":2,"../lib/loadScript":3,"../lib/parallel":4}]},{},[5]);
