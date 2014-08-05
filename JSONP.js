"use strict";

module.exports = JSONP;

function JSONP(file, head, fn) {
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
