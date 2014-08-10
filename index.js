"use strict";

var through = require('through2');
var sort = require('deps-sort');
var combineSourceMap = require('combine-source-map');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var fold = require('./lib/fold');
var forOwn = require('./lib/forOwn');

var defaultPreludePath = path.join(__dirname, 'preludes', 'prelude.js');
var defaultPrelude = fs.readFileSync(defaultPreludePath);

module.exports = partition;

function partition(b, opts) {

  opts = normalizeOptions(b, opts);

  var map = JSON.parse(fs.readFileSync(opts.map));
  var cwd = opts.cwd;

  var modulesByFile = {};
  var moduleBelongsTo = {};
  var shortIDLabels = {};

  // output files
  var files = Object.keys(map);
  // streams for the output files
  var streams = {};

  // first file, with prelude
  var firstFile = path.resolve(cwd, "main.js");

  files.forEach(function(file) {
    // resolve filename and require modules
    map[file].forEach(function(mod, i) {
      mod = map[file][i] = path.resolve(cwd, mod);
      b.require(mod, {expose: mod, entry: true});
    });
  });

  function createStream(file) {
    // create output stream for this file
    var stream = through.obj();
    var outFile = path.resolve(opts.output, file);
    mkdirp.sync(path.dirname(outFile));

    var ws = fs.createWriteStream(outFile);

    stream
      .pipe(sort())
      .pipe(wrap({
        prelude: file == firstFile,
        files: files,
        map: modulesByFile,
        url: opts.url
      }))
      .pipe(ws);

    return (streams[file] = stream);
  }

  var deps = b.pipeline.get('deps');

  // initialize objects
  deps.on('data', function(row) {
    row.fullPath = path.resolve(cwd, row.file);
    modulesByFile[row.fullPath] = row;
    moduleBelongsTo[row.fullPath] = {};
    shortIDLabels[row.id] = relativeID(cwd + '/a', row.id);
  });

  // search through the dependencies recursively, and associate each dependency
  // to a target file
  function depsBelongTo(deps, file) {
    forOwn(deps, function(dep) {
      dep = modulesByFile[path.resolve(cwd, dep)];
      var belong = moduleBelongsTo[dep.fullPath];
      var count = belong[file] = (belong[file] || 0) + 1;
      // stop at 3, otherwise it might be a cyclic dependency
      if (count <= 3) depsBelongTo(dep.deps, file);
    });
  }

  deps.on('end', function() {

    var first = 0;
    forOwn(map, function(_deps, file) {
      if (first++ === 0) firstFile = file;
      // top level dependencies
      depsBelongTo(arrayToObject(_deps), file);
      createStream(file);
    });

    if (!streams[firstFile]) createStream(firstFile);

    forOwn(moduleBelongsTo, function(files, full) {
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
      modulesByFile[full].destFile = file;
    });

  });

  // replace labels by shorter IDs, if they are not replaced by numbers

  var label = b.pipeline.get('label');
  label.push(renameIDLabels(shortIDLabels));

  // write modules to the multiple output streams
  var pack = b.pipeline.get('pack');

  // write modules to the new dest file
  pack.splice(0, 1, through.obj(function(row, enc, next) {
    streams[row.destFile].push(row);
    next();
  }));

  // close each stream
  pack.on('end', function() {
    forOwn(streams, function(stream) {
      stream.push(null);
    });
  });

}

function normalizeOptions(b, opts) {
  if (!opts) opts = {};
  if (!opts.url) opts.url = '';
  if (opts.url && opts.url.slice(-1) != '/') {
    opts.url += '/';
  }
  opts.cwd = b._basedir || path.dirname(opts.map) || process.cwd();
  opts.output = opts.output || opts.o || opts.cwd;
  return opts;
}

function relativeID(from, to){
  var file = path.relative(path.dirname(from), to);
  if (file[0] != '.') file = './' + file;
  return (path.extname(file) == '.js') ? file.slice(0, -3) : file;
}

function ensureJSFileName(filename) {
  return filename + ((path.extname(filename) === '') ? '.js' : '');
}

function arrayToObject(array) {
  var obj = {};
  array.forEach(function(item) {
    obj[item] = item;
  });
  return obj;
}

function createFileMap(modules, files) {
  var map = {};
  var modsByID = {};

  forOwn(modules, function(mod) {
    modsByID[mod.id] = mod;
  });

  function search(deps, id, level) {
    forOwn(deps, function(_id) {
      var mod = modsByID[_id];
      map[id].push(files.indexOf(mod.destFile));
      if (level < 3) search(mod.deps, id, level + 1);
    });
  }

  forOwn(modules, function(mod) {
    map[mod.id] = [files.indexOf(mod.destFile)];
    search(mod.deps, mod.id, 0);
  });
  return map;
}

function renameIDLabels(map) {
  return through.obj(function(row, enc, next) {
    if (map[row.id]) {
      row.id = map[row.id];
      forOwn(row.deps, function(dep, key) {
        if (map[dep]) {
          row.deps[key] = map[dep];
        }
      });
    }
    this.push(row);
    next();
  });
}

function newlinesIn(buf) {
  return fold(buf, 0, function(char, i, count) {
    return count + (char == 10 ? 1 : 0);
  });
}

function wrapModule(row, deps) {
  return new Buffer([
    'loadjs.d("',
    row.id,
    '",function(require,module,exports){\n',
    combineSourceMap.removeComments(row.source),
    '\n},{',
    deps,
    '});\n'
  ].join(''));
}

// from object bundle into wrapped JS buffer, wrapping the source into
// __define() calls and adding the prelude for the entry file
function wrap(opts) {
  if (!opts) opts = {};

  var first = true;
  var lineno = (opts.prelude ? newlinesIn(defaultPrelude) : 0) + 1;
  var sourcemap;

  var stream = through.obj(write, end);

  return stream;

  function write(row, enc, next) {

    if (first && opts.prelude) {
      stream.push(defaultPrelude);
    }

    if (row.sourceFile && !row.nomap) {
      if (!sourcemap) {
        sourcemap = combineSourceMap.create();
      }

      if (first && opts.prelude) {
        sourcemap.addFile(
          {sourceFile: defaultPreludePath, source: defaultPrelude.toString()},
          {line: 0}
        );
      }

      sourcemap.addFile(
        {sourceFile: ensureJSFileName(row.sourceFile), source: row.source},
        {line: lineno}
      );
    }

    var deps = Object.keys(row.deps || {}).sort().map(function (key) {
      return JSON.stringify(key) + ':' + JSON.stringify(row.deps[key]);
    }).join(',');

    var wrappedSource = wrapModule(row, deps);

    stream.push(wrappedSource);
    lineno += newlinesIn(wrappedSource);

    if (first && opts.prelude) {

      stream.push(new Buffer('\nloadjs.url = "' + opts.url + '";'));

      stream.push(new Buffer('\nloadjs.files = [' + opts.files.map(function(file) {
        return '"' + file + '"';
      }).join(',') + ']'));

      stream.push(new Buffer([
        '\nloadjs.map = ',
        JSON.stringify(createFileMap(opts.map, opts.files)),
        ';'
      ].join('')));

    }

    first = false;
    next();
  }

  function end() {
    if (sourcemap) {
      var comment = sourcemap.comment();
      stream.push(new Buffer('\n' + comment + '\n'));
    }
  }

}
