var AsyncIterator = require('../asynciterator').AsyncIterator;

/*
This file measures the performance of transform iterators in two dimensions.
The first dimension is the number of elements that are pushed through the stream.
The second dimension is the number of transformations that are applied over the stream.
 */

var STREAM_ELEMENTS = [1000, 10000, 100000];
var STREAM_TRANSFORMERS = [1, 10, 100];

(async function() {
  console.log('elements:transformers:time');
  for (var x = 0; x < STREAM_ELEMENTS.length; x++) {
    for (var y = 0; y < STREAM_TRANSFORMERS.length; y++) {
      var streamElements = STREAM_ELEMENTS[x];
      var streamTransformers = STREAM_TRANSFORMERS[y];
      var key = streamElements + ':' + streamTransformers;

      console.time(key);

      var it = AsyncIterator.range(0, streamElements);
      for (var i = 0; i < streamTransformers; i++)
        it = it.map(function (element) {
          return element + 1;
        });

      it.on('data', noop);
      await new Promise(resolve => it.on('end', resolve));
      console.timeEnd(key);
    }
  }

  // Trigger end when running in Web browser
  if (typeof window !== 'undefined' && window.onEnd) {
    window.onEnd();
  }
})();

function noop() {}
