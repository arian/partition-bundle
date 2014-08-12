"use strict";

var through = require('through2');
var sort = require('deps-sort');
var combineSourceMap = require('combine-source-map');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var fold = require('./lib/fold');
var forOwn = require('./lib/forOwn');
var append = require('./lib/append');

var defaultPreludePath = path.join(__dirname, 'preludes', 'prelude.js');
var defaultPrelude = fs.readFileSync(defaultPreludePath);

module.exports = partition;

function partition(b, opts) {

  opts = normalizeOptions(b, opts);

  var map = opts.map;
  var cwd = opts.cwd;

  var modulesByID = {};
  var moduleBelongsTo = {};
  var shortIDLabels = {};
  var labelCount = 1;

  // output files
  var files = Object.keys(map);
  // streams for the output files
  var streams = {};

  // first file, with prelude
  var firstFile = path.resolve(cwd, "main.js");

  // require the modules from the map
  files.forEach(function(file) {
    map[file].forEach(function(mod, i) {
      map[file][i] = mod = ensureJSFileName(path.resolve(cwd, mod));
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
        map: modulesByID,
        url: opts.url
      }))
      .pipe(ws);

    // kinda hacky, to notify the stream has finished, unfortunately
    // doesn't seem to happen automatically
    ws.on('finish', function() {
      stream.emit('finish');
    });

    streams[file] = stream;
    return stream;
  }

  var deps = b.pipeline.get('deps');

  // initialize objects
  deps.on('data', function(row) {
    modulesByID[row.id] = row;
    moduleBelongsTo[row.id] = {};
    if (row.expose || row.entry) {
      shortIDLabels[row.id] = relativeID(cwd + '/a', path.resolve(cwd, row.file));
    } else {
      shortIDLabels[row.id] = labelCount++;
    }
  });

  // search through the dependencies recursively, and associate each dependency
  // to a target file
  function depsBelongTo(deps, file) {
    forOwn(deps, function(dep) {
      dep = modulesByID[dep];
      var belong = moduleBelongsTo[dep.id];
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
  });

  // replace labels by shorter IDs, if they are not replaced by numbers
  var label = b.pipeline.get('label');
  label.splice(0, 1, renameIDLabels(shortIDLabels));

  // write modules to the multiple output streams
  var pack = b.pipeline.get('pack');
  pack.splice(0, 1, writeStreams(streams));

}

function normalizeOptions(b, opts) {
  if (!opts) opts = {};
  if (!opts.url) opts.url = '';
  if (opts.url && opts.url.slice(-1) != '/') {
    opts.url += '/';
  }

  var mapFile = opts.map;
  var mapIsFile = (typeof mapFile == 'string');
  if (mapIsFile) {
    opts.map = JSON.parse(fs.readFileSync(mapFile));
  }

  opts.cwd = b._basedir || (mapIsFile && path.dirname(mapFile)) || process.cwd();
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

function renameIDLabels(map) {
  var buf = []; // buffer so each row is renamed before continuing
  return through.obj(function(row, enc, next) {
    if (map[row.id]) {
      row.id = map[row.id];
    }
    forOwn(row.deps, function(dep, key) {
      if (map[dep]) {
        row.deps[key] = map[dep];
      }
    });
    buf.push(row);
    next();
  }, function() {
    buf.forEach(function(row) {
      this.push(row);
    }, this);
    this.push(null);
  });
}

function createFileMap(modules, files) {
  var map = {};
  var modsByID = {};

  forOwn(modules, function(mod, id) {
    modsByID[mod.id] = mod;
  });

  function search(deps, id, level) {
    forOwn(deps, function(_id) {
      var mod = modsByID[_id];
      append(map[id], files.indexOf(mod.destFile));
      if (level < 3) search(mod.deps, id, level + 1);
    });
  }

  forOwn(modules, function(mod) {
    map[mod.id] = [files.indexOf(mod.destFile)];
    search(mod.deps, mod.id, 0);
  });
  return map;
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
    stream.push(null);
  }

}

function writeStreams(streams) {
  var count = 0;
  var s = through.obj(function(row, enc, next) {
    streams[row.destFile].push(row);
    next();
  }, function() {
    forOwn(streams, function(stream, file) {
      // add event to see if all streams have finished
      stream.on('finish', function() {
        if (++count == Object.keys(streams).length) {
          s.push(null);
        }
      });
      // close each stream
      stream.push(null);
    });
  });
  return s;
}
