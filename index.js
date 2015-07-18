"use strict";

var through = require('through2');
var sort = require('deps-sort');
var combineSourceMap = require('combine-source-map');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var bresolve = require('browser-resolve');
var fold = require('./lib/fold');
var forOwn = require('./lib/forOwn');
var append = require('./lib/append');
var partition = require('./lib/partition');

var defaultPreludePath = path.join(__dirname, 'preludes', 'prelude.js');
var defaultPrelude = fs.readFileSync(defaultPreludePath);

module.exports = partitionBundle;

function partitionBundle(b, opts) {

  opts = normalizeOptions(b, opts);
  var shortIDLabels = opts.shortIDLabels = {};

  // require the modules from the map
  forOwn(opts.map, function(modules, file) {
    modules.forEach(function(mod, i) {
      var id = bresolve.sync(mod, {basedir: opts.mapDir});
      shortIDLabels[id] = mod;
      modules[i] = id;
      b.require(id, {entry: true});
    });
  });

  // on reset, a new pipeline is installed, make sure we
  // alter this one new one with our events too.
  b.on('reset', function() {
    installBundlePipeline(b.pipeline, opts);
  });

  // install initial pipeline
  installBundlePipeline(b.pipeline, opts);

}

function installBundlePipeline(pipeline, opts) {

  var cwd = opts.cwd;

  var shortIDLabels = opts.shortIDLabels;
  var labelCount = 1;

  // streams for the output files
  var streams = {};

  function createStream(file, modulesByID, firstFile) {
    // create output stream for this file
    var stream = through.obj();
    var outFile = path.resolve(opts.output, file);
    var outDir = path.dirname(outFile);
    mkdirp.sync(outDir);

    var ws = fs.createWriteStream(outFile);

    stream
      .pipe(sort())
      .pipe(wrap({
        prelude: file == firstFile,
        firstFile: firstFile,
        files: Object.keys(opts.map),
        map: modulesByID,
        labels: shortIDLabels,
        url: opts.url,
        main: opts.main
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

  var partitioner = partition(opts.map, path.resolve(cwd, "main.js"));
  var deps = pipeline.get('deps');

  // initialize objects
  deps.on('data', function(row) {
    partitioner.addModule(row);
    // use a numeric label if the module doesn't have to be required
    // by the user
    if (!(row.expose || row.entry)) {
      shortIDLabels[row.id] = labelCount++;
    }
  });

  deps.on('end', function() {
    var partitioned = partitioner.partition();
    partitioned.files.forEach(function(file) {
      streams[file] = createStream(
        file,
        partitioned.modulesByID,
        partitioned.firstFile
      );
    });
  });

  // replace labels by shorter IDs, if they are not replaced by numbers
  var label = pipeline.get('label');
  label.splice(0, 1, renameIDLabels(shortIDLabels));

  // write modules to the multiple output streams
  var pack = pipeline.get('pack');
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
  if (!opts.map) {
    opts.map = {};
  }

  var cwd = b._basedir || opts.basedir || (mapIsFile && path.dirname(mapFile)) || path.resolve(process.cwd());
  opts.cwd = path.resolve(cwd);
  opts.mapDir = mapIsFile ? path.resolve(path.dirname(mapFile)) : opts.cwd;
  opts.output = opts.output || opts.o || opts.cwd;

  if (opts.main && !Array.isArray(opts.main)) {
    opts.main = [opts.main];
  }

  return opts;
}

function relativeID(from, to){
  var file = path.relative(path.dirname(from), to);
  file = file.replace(/\\/g, '/').replace(/\/$/g, '');
  if (file[0] != '.') file = './' + file;
  return (path.extname(file) == '.js') ? file.slice(0, -3) : file;
}

function ensureJSFileName(filename) {
  return filename + ((path.extname(filename) === '') ? '.js' : '');
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

function createFileMap(modules, files, entry) {
  var map = {};
  var modsByID = {};

  forOwn(modules, function(mod, id) {
    modsByID[mod.id] = mod;
    map[mod.id] = [];
  });

  function push(id, dest) {
    if (dest != entry) {
      append(map[id], files.indexOf(dest));
    }
  }

  function search(deps, id, searched, log) {
    forOwn(deps, function(_id) {
      var mod = modsByID[_id];

      if (searched[_id]) return;
      searched[_id] = true;

      push(id, mod.destFile);
      search(mod.deps, id, searched, log);
    });
  }

  forOwn(modules, function(mod) {
    var searched = {};
    searched[mod.id] = true;
    push(mod.id, mod.destFile);
    search(mod.deps, mod.id, searched, (mod.id + '').match(/editsmark/i));
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

    var deps = row.deps || {};

    // make sure the deduped file requires the other module correctly.
    // Browserify requires "require(dedupeIndex)". In our case however, it
    // is easier to simply require by the module ID directly.
    if (row.dedupe) {
      row.source = "module.exports=require(0);";
      deps[0] = opts.labels[row.dedupe];
    }

    deps = Object.keys(deps).sort().map(function (key) {
      return JSON.stringify(key) + ':' + JSON.stringify(row.deps[key]);
    }).join(',');

    var wrappedSource = wrapModule(row, deps);

    stream.push(wrappedSource);
    lineno += newlinesIn(wrappedSource);

    if (first && opts.prelude) {

      if (opts.url) {
        stream.push(new Buffer('\nloadjs.url = "' + opts.url + '";'));
      }

      stream.push(new Buffer('\nloadjs.files = [' + opts.files.map(function(file) {
        return '"' + file + '"';
      }).join(',') + ']'));

      stream.push(new Buffer([
        '\nloadjs.map = ',
        JSON.stringify(createFileMap(opts.map, opts.files, opts.firstFile)),
        ';'
      ].join('')));

    }

    first = false;
    next();
  }

  function end() {
    if (opts.main && opts.prelude) {
      stream.push(new Buffer("loadjs(" + JSON.stringify(opts.main) + ");\n"));
    }

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
