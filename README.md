partition-bundle
================

A [browserify](https://www.npmjs.org/package/browserify) plugin to pack
multiple related modules together in separate files to make the initial
pageload smaller.

```
npm install partition-bundle
```

Example
-------

```
browserify -p [ partition-bundle --map mapping.json --output output/directory --url directory --main ./entry ]
```

Configuration file
-------------------

In the mapping/configuration file you can define which module ends up in which
output file.  Here you can group files together.

```
{
  "entry.js": ["./a"],
  "common.js": ["./b"],
  "common/extra.js": ["./e", "./d"]
}
```

The modules in this file are automatically required (so no need to extra `-r
module`). Dependencies of those files are grouped into the same destination
file.

The first row is the entry file. This file is the file you need to add to your
page with a `<script src="entry.js"></script>`. This also includes necessary
boilerplate to load the other files.

Loading modules
---------------

As some modules are in other files, you obviously need to load them at some
point once they are needed. The entry file includes a simple loader which
can load the necessary files automatically.

For example in **a.js**, which is in **entry.js** you have this:
```
a.addEventListener('click', function() {
  loadjs(['./e', './d'], function(e, d) {
    console.log(e, d);
  });
});
```

Once the listener is executed, the **common/extra.js** file is loaded and the
`e` and `d` modules become available.

**Note:** once a module is loaded, the file won't be loaded again, but the
result will be cached and returned by other `loadjs` or `require` calls, as
you are used to with normal modules.

Difference with [factor-bundle](https://www.npmjs.org/package/factor-bundle)
----------------------------------------------------------------------------

factor-bundle is much like this plugin, except that it does not add a loader.
It can factor-out common modules in to different output files, but then you
need to manually load the files with `<script>` tags. **partition-budle** can
load the excluded modules later using the `loadjs` function and by simply using
the module ID, rather than the final JS filename.

