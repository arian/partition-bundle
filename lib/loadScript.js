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
