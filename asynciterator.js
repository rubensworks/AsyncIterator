var EventEmitter = require('events').EventEmitter;

/**
  Names of possible iterator states.
  The state's position in the array corresponds to its ID.

  @name AsyncIterator.STATES
  @type String[]
*/
var STATES = AsyncIterator.STATES = ['INIT', 'OPEN', 'CLOSING', 'CLOSED', 'ENDED'];
var INIT = 0, OPEN = 1, CLOSING = 2, CLOSED = 3, ENDED = 4;
STATES.forEach(function (state, id) { AsyncIterator[state] = id; });

/**
  ID of the INIT state.
  An iterator is initializing if it is preparing main item generation.
  It can already produce items.

  @name AsyncIterator.OPEN
  @type integer
*/

/**
  ID of the OPEN state.
  An iterator is open if it can generate new items.

  @name AsyncIterator.OPEN
  @type integer
*/

/**
  ID of the CLOSING state.
  An iterator is closing if item generation is pending but will not be scheduled again.

  @name AsyncIterator.CLOSING
  @type integer
*/

/**
  ID of the CLOSED state.
  An iterator is closed if it no longer actively generates new items.
  Items might still be available.

  @name AsyncIterator.CLOSED
  @type integer
*/

/**
  ID of the ENDED state.
  An iterator has ended if no further items will become available.

  @name AsyncIterator.ENDED
  @type integer
*/




/**
  Creates a new `AsyncIterator`.

  @constructor
  @classdesc An asynchronous iterator provides pull-based access to a stream of objects.
  @extends EventEmitter
**/
function AsyncIterator() {
  if (!(this instanceof AsyncIterator))
    return new AsyncIterator();
  EventEmitter.call(this);
  this.on('newListener', waitForDataListener);
  this._state = OPEN;
  this._readable = false;
}

/**
  Makes objects of the specified iterator constructor inherit from the current iterator.

  @function
  @name AsyncIterator.isPrototypeOf
  @param {Function} Constructor The constructor whose instances should inherit
  @returns {AsyncIterator} The child object's prototype
**/
var AsyncIteratorPrototype = (function isPrototypeOf(Constructor) {
  var prototype = Constructor.prototype = Object.create(this.prototype,
    { constructor: { value: Constructor, configurable: true, writable: true } });
  Constructor.isPrototypeOf = isPrototypeOf;
  return prototype;
})
.call(EventEmitter, AsyncIterator);

/**
  Changes the iterator to the given state if possible and necessary,
  possibly emitting events to signal that change.

  @protected
  @function
  @name AsyncIterator#_changeState
  @param {integer} newState The ID of the new state (from the `STATES` array)
  @param {boolean} [eventAsync=false] Whether resulting events should be emitted asynchronously
  @returns {boolean} Whether the state was changed
  @emits AsyncIterator.end
**/
AsyncIteratorPrototype._changeState = function (newState, eventAsync) {
  // Validate the state change
  var valid = newState > this._state;
  if (valid) {
    this._state = newState;
    // Emit the `end` event when changing to ENDED
    if (newState === ENDED)
      eventAsync ? setImmediate(emit, this, 'end') : this.emit('end');
  }
  return valid;
};
// Emits the event on the given EventEmitter
function emit(self, eventName) { self.emit(eventName); }

/**
  Tries to read the next item from the iterator.

  This is the main method for reading the iterator in _on-demand mode_,
  where new items are only created when needed by consumers.
  If no items are currently available, this methods returns `undefined`.
  The {@link AsyncIterator.event:readable} event will then signal when new items might be ready.

  To read all items from the stream,
  switch to _flow mode_ by subscribing to the {@link AsyncIterator.event:data} event.
  When in flow mode, do not use the `read` method.

  @function
  @name AsyncIterator#read
  @returns {object?} The next item, or `undefined` if none is available
**/
AsyncIteratorPrototype.read = function () { };

/**
  Emitted when the iterator possibly has new items available,
  which can be retrieved by calling {@link AsyncIterator#read}.

  @event AsyncIterator.readable
**/

/**
  Verifies whether the iterator has listeners for the given event.

  @private
  @function
  @name AsyncIterator#_hasListeners
  @param {string} eventName The name of the event
  @returns {boolean} Whether the iterator has listeners
**/
AsyncIteratorPrototype._hasListeners = function (eventName) {
  return this._events && (eventName in this._events);
};

/**
  Adds the listener to the event, if it has not been added previously.

  @private
  @function
  @name AsyncIterator#_addSingleListener
  @param {string} eventName The name of the event
  @param {Function} listener The listener to add
**/
AsyncIteratorPrototype._addSingleListener = function (eventName, listener) {
  var listeners = this._events && this._events[eventName];
  if (!listeners || (isFunction(listeners) ? listeners !== listener
                                           : listeners.indexOf(listener) < 0))
    this.addListener(eventName, listener);
};

/**
  Stops the iterator from generating new items.

  Already generated items, or terminating items, can still be emitted.
  After this, the iterator will end asynchronously.

  @function
  @name AsyncIterator#close
  @emits AsyncIterator.end
**/
AsyncIteratorPrototype.close = function () {
  if (this._changeState(CLOSED))
    endAsync(this);
};

/**
  Asynchronously ends the iterator and cleans up.

  Should never be called before {@link AsyncIterator#close};
  typically, `close` is responsible for calling `_end`.

  @protected
  @function
  @name AsyncIterator#_end
  @emits AsyncIterator.end
**/
AsyncIteratorPrototype._end = function () {
  if (this._changeState(ENDED)) {
    this.removeAllListeners('readable');
    this.removeAllListeners('data');
    this.removeAllListeners('end');
  }
};
function end(self) { self._end(); }
function endAsync(self) { setImmediate(end, self); }

/**
  Emitted after the last item of the iterator has been read.

  @event AsyncIterator.end
**/

/**
  Whether items can potentially be read from the iterator.

  @name AsyncIterator#readable
  @type boolean
  @emits AsyncIterator.readable
**/
Object.defineProperty(AsyncIteratorPrototype, 'readable', {
  get: function () { return this._readable; },
  set: function (readable) {
    readable = !!readable;
    // Set the readable value only if it has changed
    if (this._readable !== readable) {
      this._readable = readable;
      // If the iterator became readable, emit the `readable` event
      if (readable)
        setImmediate(emit, this, 'readable');
    }
  },
  enumerable: true,
});

/**
  Whether the iterator has stopped generating new items

  @name AsyncIterator#closed
  @type boolean
**/
Object.defineProperty(AsyncIteratorPrototype, 'closed', {
  get: function () { return this._state >= CLOSING; },
  enumerable: true,
});

/**
  Whether the iterator has stopped emitting items

  @name AsyncIterator#ended
  @type boolean
**/
Object.defineProperty(AsyncIteratorPrototype, 'ended', {
  get: function () { return this._state === ENDED; },
  enumerable: true,
});

/**
  Emitted when a new item is available on the iterator.

  As soon as one or more listeners are attached to the `data` event,
  the iterator switches to _flow mode_,
  generating and emitting new items as fast as possible.
  This drains the source and might create backpressure on the consumers,
  so only subscribe to this event if this behavior is intended.
  In flow mode, don't use the {@link AsyncIterator#read} method.

  To switch back to _on-demand mode_,
  remove all listeners from the `data` event.
  You can then obtain items through {@link AsyncIterator#read} again.

  @event AsyncIterator.data
  @param {object} item The new item
**/

// Starts emitting `data` events when `data` listeners are added
function waitForDataListener(eventName) {
  if (eventName === 'data') {
    this.removeListener('newListener', waitForDataListener);
    this._addSingleListener('readable', emitData);
    if (this.readable)
      setImmediate(call, emitData, this);
  }
}
// Emits new items though `data` events as long as there are `data` listeners
function emitData() {
  // While there are `data` listeners and items, emit them
  var item;
  while (this._hasListeners('data') && (item = this.read()) !== undefined)
    this.emit('data', item);
  // Stop draining the source if there are no more `data` listeners
  if (!this._hasListeners('data')) {
    this.removeListener('readable', emitData);
    this._addSingleListener('newListener', waitForDataListener);
  }
}
// Calls the given function with the specified argument as `this` value
function call(func, self) { func.call(self); }



/**
  Creates a new `EmptyIterator`.

  @constructor
  @classdesc An iterator that doesn't emit any items.
  @extends AsyncIterator
**/
function EmptyIterator() {
  if (!(this instanceof EmptyIterator))
    return new EmptyIterator();
  AsyncIterator.call(this);
  this._changeState(ENDED, true);
}
AsyncIterator.isPrototypeOf(EmptyIterator);



/**
  Creates a new `SingletonIterator`.

  @constructor
  @classdesc An iterator that emits a single item.
  @param {object} item The item that will be emitted.
  @extends AsyncIterator
**/
function SingletonIterator(item) {
  if (!(this instanceof SingletonIterator))
    return new SingletonIterator(item);
  AsyncIterator.call(this);

  if (item === undefined)
    this.close();
  else
    this._item = item, this.readable = true;
}
var SingletonIteratorPrototype = AsyncIterator.isPrototypeOf(SingletonIterator);

/* Reads the item from the iterator. */
SingletonIteratorPrototype.read = function () {
  var item = this._item;
  delete this._item;
  this.close();
  return item;
};



/**
  Creates a new `ArrayIterator`.

  @constructor
  @classdesc An iterator that emits the items of a given array.
  @param {Array} items The items that will be emitted.
  @extends AsyncIterator
**/
function ArrayIterator(items) {
  if (!(this instanceof ArrayIterator))
    return new ArrayIterator(items);
  AsyncIterator.call(this);

  if (!(items && items.length > 0))
    return this.close();

  this._buffer = Array.prototype.slice.call(items);
  this.readable = true;
}
var ArrayIteratorPrototype = AsyncIterator.isPrototypeOf(ArrayIterator);

/* Reads an item from the iterator. */
ArrayIteratorPrototype.read = function () {
  var buffer = this._buffer;
  if (buffer) {
    var item = buffer.shift();
    if (!buffer.length) {
      this.close();
      delete this._buffer;
    }
    return item;
  }
};



/**
  Creates a new `IntegerIterator`.

  @constructor
  @classdesc An iterator that enumerates integers in a certain range.
  @param {object} [options] Settings of the iterator
  @param {integer} [options.start=0] The first number to emit
  @param {integer} [options.end=Infinity] The last number to emit
  @param {integer} [options.step=1] The increment between two numbers
  @extends AsyncIterator
**/
function IntegerIterator(options) {
  if (!(this instanceof IntegerIterator))
    return new IntegerIterator(options);
  AsyncIterator.call(this);

  // Set start, end, and step
  options = options || {};
  var step = options.step, limit, last = options.end, next = options.start;
  this._step = step  = isFinite(step) ? ~~step : 1;
  limit      = step >= 0 ? Infinity : -Infinity; // counting towards plus or minus infinity?
  this._last = last  = isFinite(last) ? ~~last : (last === -limit ? last : limit);
  this._next = next  = typeof next !== 'number' ? 0 : (isFinite(next) ? ~~next : next);

  // Start iteration if there is at least one item; close otherwise
  if (!isFinite(next) || (step >= 0 ? next > last : next < last))
    this.close();
  else
    this.readable = true;
}
var IntegerIteratorPrototype = AsyncIterator.isPrototypeOf(IntegerIterator);

/* Reads an item from the iterator. */
IntegerIteratorPrototype.read = function () {
  if (!this.closed) {
    var current = this._next, step = this._step, last = this._last, next = this._next += step;
    if (step >= 0 ? next > last : next < last)
      this.close();
    return current;
  }
};



/**
  Creates a new `BufferedIterator`.

  @constructor
  @classdesc A iterator that maintains an internal buffer of items.

  This class serves as a base class for other iterators
  with a typically complex item generation process.
  @param {object} [options] Settings of the iterator
  @param {integer} [options.bufferSize=4] The number of items to keep in the buffer
  @param {boolean} [options.autoStart=true] Whether buffering starts directly after construction
  @extends AsyncIterator
**/
function BufferedIterator(options) {
  if (!(this instanceof BufferedIterator))
    return new BufferedIterator(options);
  AsyncIterator.call(this);

  options = options || {};

  // Set up the internal buffer
  var bufferSize = options.bufferSize, autoStart = options.autoStart;
  this._buffer = [];
  this._bufferSize = bufferSize = isFinite(bufferSize) ? Math.max(~~bufferSize, 1) : 4;

  // Initialize the iterator
  this._state = INIT;
  this._reading = true;
  setImmediate(init, this, autoStart === undefined || autoStart);
}
var BufferedIteratorPrototype = AsyncIterator.isPrototypeOf(BufferedIterator);

/**
  Initializing the iterator by calling {@link BufferedIterator#_begin}
  and changing state from INIT to OPEN.

  @protected
  @function
  @name BufferedIterator#_init
  @param {boolean} autoStart Whether reading of items should immediately start after OPEN.
**/
BufferedIteratorPrototype._init = function (autoStart) {
  // Perform initialization tasks
  var self = this;
  this._reading = true;
  this._begin(function () {
    if (!self)
      throw new Error('done callback called multiple times');
    // Open the iterator and start buffering
    self._reading = false;
    self._changeState(OPEN);
    if (autoStart)
      fillBufferAsync(self);
    // If reading should not start automatically, the iterator doesn't become readable.
    // Therefore, mark the iterator as (potentially) readable so consumers know it might be read.
    else
      self._readable = true;
    self = null;
  });
};
function init(self, autoStart) { self._init(autoStart); }

/**
  Writes beginning items and opens iterator resources.

  Should never be called before {@link BufferedIterator#_init};
  typically, `_init` is responsible for calling `_begin`.

  @protected
  @function
  @name BufferedIterator#_begin
  @param {function} done To be called when initialization is complete
**/
BufferedIteratorPrototype._begin = function (done) { done(); };

/**
  Tries to read the next item from the iterator.

  If the buffer is empty,
  this method calls {@link BufferedIterator#_read} to fetch items.
  @returns {object?} The next item, or `undefined` if none is available
**/
BufferedIteratorPrototype.read = function () {
  if (this.ended) return;

  // Try to retrieve an item from the buffer
  var buffer = this._buffer, item = buffer.shift();
  if (item === undefined)
    this.readable = false;

  // If the buffer is becoming empty, either fill it or end the iterator
  if (!this._reading && buffer.length < this._bufferSize) {
    // If the iterator is not closed and thus may still generate new items, fill the buffer
    if (!this.closed)
      fillBufferAsync(this);
    // No new items will be generated, so if none are buffered, the iterator ends here
    else if (!buffer.length)
      endAsync(this);
  }

  return item;
};

/**
  Tries to generate the given number of items.

  Implementers should add `count` items through {@link BufferedIterator#_push}.

  @protected
  @function
  @name BufferedIterator#_read
  @param {integer} count The number of items to generate
  @param {function} done To be called when reading is complete
**/
BufferedIteratorPrototype._read = function (count, done) { done(); };

/**
  Adds an item to the internal buffer.

  @protected
  @function
  @name BufferedIterator#_push
  @param {object} item The item to add
  @emits AsyncIterator.readable
**/
BufferedIteratorPrototype._push = function (item) {
  if (this.ended)
    throw new Error('Cannot push after the iterator was ended.');
  this._buffer.push(item);
  this.readable = true;
};

/**
  Fills the internal buffer until `this.bufferSize` items are present.

  This method calls {@link BufferedIterator#_read} to fetch items.

  @protected
  @function
  @name BufferedIterator#_fillBuffer
  @emits AsyncIterator.readable
**/
BufferedIteratorPrototype._fillBuffer = function () {
  var self = this, neededItems;
  // Avoid recursive reads
  if (this._reading)
    return;
  // If iterator closing started in the meantime, don't generate new items anymore
  else if (this.closed)
    this._completeClose();
  // Otherwise, try to fill empty spaces in the buffer by generating new items
  else if ((neededItems = this._bufferSize - this._buffer.length) > 0) {
    this._reading = true;
    this._read(neededItems, function () {
      // Verify the callback is only called once
      if (!neededItems)
        throw new Error('done callback called multiple times');
      neededItems = 0;
      self._reading = false;
      // If the iterator was closed while reading, complete closing
      if (self.closed)
        self._completeClose();
    });
  }
};
function fillBufferAsync(self) {
  // Take reading lock to avoid recursive reads
  if (!self._reading) {
    self._reading = true;
    setImmediate(fillBufferAsyncCallback, self);
  }
}
function fillBufferAsyncCallback(self) {
  // Free reading lock so _fillBuffer` can take it
  self._reading = false;
  self._fillBuffer();
}

/**
  Stops the iterator from generating new items
  after a possible pending read operation has finished.

  Already generated, pending, or terminating items can still be emitted.
  After this, the iterator will end asynchronously.

  @function
  @name BufferedIterator#close
  @emits AsyncIterator.end
**/
BufferedIteratorPrototype.close = function () {
  // If the iterator is not currently reading, we can close immediately
  if (!this._reading)
    this._completeClose();
  // Closing cannot complete when reading, so temporarily assume CLOSING state
  // `_fillBuffer` becomes responsible for calling `_completeClose`
  else
    this._changeState(CLOSING);
};

/**
  Stops the iterator from generating new items,
  switching from `CLOSING` state into `CLOSED` state.

  @protected
  @function
  @name BufferedIterator#_completeClose
  @emits AsyncIterator.end
**/
BufferedIteratorPrototype._completeClose = function () {
  if (this._changeState(CLOSED)) {
    // Write possible terminating items
    var self = this;
    this._reading = true;
    this._flush(function () {
      if (!self._reading)
        throw new Error('done callback called multiple times');
      self._reading = false;
      // If no items are left, end the iterator
      // Otherwise, `read` becomes responsible for ending the iterator
      if (!self._buffer.length)
        endAsync(self);
    });
  }
};

/**
  Writes terminating items and closes iterator resources.

  Should never be called before {@link BufferedIterator#close};
  typically, `close` is responsible for calling `_flush`.

  @protected
  @function
  @name BufferedIterator#_flush
  @param {function} done To be called when termination is complete
**/
BufferedIteratorPrototype._flush = function (done) { done(); };




/**
  Creates a new `TransformIterator`.

  This class serves as a base class for other iterators.

  @constructor
  @classdesc An iterator that generates items based on a source iterator.
  @param {AsyncIterator} [source] The source this iterator generates items from
  @param {object} [options] Settings of the iterator
  @param {integer} [options.bufferSize=4] The number of items to keep in the buffer
  @param {boolean} [options.autoStart=true] Whether buffering starts directly after construction
  @param {AsyncIterator} [options.source] The source this iterator generates items from
  @extends BufferedIterator
**/
function TransformIterator(source, options) {
  if (!(this instanceof TransformIterator))
    return new TransformIterator(source, options);
  // Shift arguments if the first is not a source
  if (!source || !isFunction(source.read)) {
    if (!options) options = source;
    source = options && options.source;
  }
  BufferedIterator.call(this, options);
  if (source) this.source = source;
}
var TransformIteratorPrototype = BufferedIterator.isPrototypeOf(TransformIterator);

/**
  The source this iterator generates items from

  @function
  @name AsyncIterator#source
  @type AsyncIterator
**/
Object.defineProperty(TransformIterator.prototype, 'source', {
  set: function (source) {
    // Verify and set source
    if (this._source)
      throw new Error('The source cannot be changed after it has been set');
    if (!source || !isFunction(source.read) || !isFunction(source.on))
      throw new Error('Invalid source: ' + source);
    if (source._destination)
      throw new Error('The source already has a destination');
    this._source = source;
    source._destination = this;

    // Close this iterator if the source has already ended
    if (source.ended)
      return this.close();

    // React to source events
    source.once('end', destinationClose);
    source.on('readable', destinationFillBuffer);
  },
  get: function () { return this._source; },
  enumerable: true,
});
function destinationClose() { this._destination.close(); }
function destinationFillBuffer() { this._destination._fillBuffer(); }

/* Tries to read and transform an item */
TransformIteratorPrototype._read = function (count, done) {
  var source = this._source, item;
  // If the source exists and still can read items,
  // try to read and transform the next item.
  if (source && !source.ended && (item = source.read()) !== undefined)
    this._transform(item, done);
  else
    done();
};

/**
  Generates items based on the item from the source.

  Implementers should add items through {@link BufferedIterator#_push}.
  The default implementation pushes the source item as-is.

  @protected
  @function
  @name TransformIterator#_transform
  @param {object} item The last read item from the source
  @param {function} done To be called when reading is complete
**/
TransformIteratorPrototype._transform = function (item, done) {
  this._push(item), done();
};

/* Cleans up the source iterator and ends. */
TransformIteratorPrototype._end = function () {
  var source = this._source;
  if (source) {
    source.removeListener('readable', destinationFillBuffer);
    delete source._destination;
  }
  BufferedIteratorPrototype._end.call(this);
};




/**
  Creates a new `SimpleTransformIterator`.

  @constructor
  @classdesc An iterator that generates items based on a source iterator
             and simple transformation steps passed as arguments.
  @param {AsyncIterator} [source] The source this iterator generates items from
  @param {object} [options] Settings of the iterator
  @param {integer} [options.bufferSize=4] The number of items to keep in the buffer
  @param {boolean} [options.autoStart=true] Whether buffering starts directly after construction
  @param {AsyncIterator} [options.source] The source this iterator generates items from
  @param {Function} [options.map] A function to synchronously transform elements from the source
  @param {Array|AsyncIterator} [options.prepend] Items to insert before the source items
  @param {Array|AsyncIterator} [options.append]  Items to insert after the source items
  @extends TransformIterator
**/
function SimpleTransformIterator(source, options) {
  if (!(this instanceof SimpleTransformIterator))
    return new SimpleTransformIterator(source, options);
  TransformIterator.call(this, source, options);

  // Set transformation steps from the options
  if (options = options || !isFunction(source && source.read) && source) {
    var map = options.map, prepend = options.prepend, append = options.append;
    if (isFunction(map)) this._map = map;
    if (prepend) this._prepender = prepend.on ? prepend : new ArrayIterator(prepend);
    if (append)  this._appender  = append.on  ? append  : new ArrayIterator(append);
  }
}
var SimpleTransformIteratorPrototype = TransformIterator.isPrototypeOf(SimpleTransformIterator);

// Default mapping function
SimpleTransformIteratorPrototype._map = function (item) { return item; };

// Transforms items using the mapping function
SimpleTransformIteratorPrototype._transform = function (item, done) {
  this._push(this._map(item)), done();
};

// Prepends items to the iterator
SimpleTransformIteratorPrototype._begin = function (done) {
  this._insert(this._prepender, done);
  delete this._prepender;
};

// Appends items to the iterator
SimpleTransformIteratorPrototype._flush = function (done) {
  this._insert(this._appender, done);
  delete this._appender;
};

// Inserts items in the iterator
SimpleTransformIteratorPrototype._insert = function (inserter, done) {
  var self = this;
  if (!inserter || inserter.ended)
    done();
  else
    inserter.on('data', push), inserter.once('end', end);
  function push(item) { self._push(item); }
  function end() { inserter.removeListener('data', push); done(); }
};

/**
  Maps items from this iterator using the given function.

  The current iterator may not be read anymore after this operation.

  @function
  @name AsyncIterator#map
  @param {Function} mapper A mapping function to call on this iterator's (remaining) items
  @returns {AsyncIterator} A new iterator that maps the items from this iterator
**/
AsyncIteratorPrototype.map = function (mapper) {
  return new SimpleTransformIterator(this, { map: mapper });
};

/**
  Prepends the items to the current iterator.

  The current iterator may not be read anymore after this operation.

  @function
  @name AsyncIterator#prepend
  @param {Array|AsyncIterator} items Items to insert before this iterator's (remaining) items
  @returns {AsyncIterator} A new iterator that prepends items to this iterator
**/
AsyncIteratorPrototype.prepend = function (items) {
  return new SimpleTransformIterator(this, { prepend: items });
};

/**
  Appends the items to the current iterator.

  The current iterator may not be read anymore after this operation.

  @function
  @name AsyncIterator#append
  @param {Array|AsyncIterator} items Items to insert after this iterator's (remaining) items
  @returns {AsyncIterator} A new iterator that prepends items to this iterator
**/
AsyncIteratorPrototype.append = function (items) {
  return new SimpleTransformIterator(this, { append: items });
};

/**
  Surrounds items of the current iterator with the given items.

  The current iterator may not be read anymore after this operation.

  @function
  @name AsyncIterator#surround
  @param {Array|AsyncIterator} prepend Items to insert before this iterator's (remaining) items
  @param {Array|AsyncIterator} append Items to insert after this iterator's (remaining) items
  @returns {AsyncIterator} A new iterator that appends and prepends items to this iterator
**/
AsyncIteratorPrototype.surround = function (prepend, append) {
  return new SimpleTransformIterator(this, { prepend: prepend, append: append });
};




// Determines whether the given object is a function
function isFunction(object) { return typeof object === 'function'; }

// Export all submodules
module.exports = {
  AsyncIterator: AsyncIterator,
  EmptyIterator: EmptyIterator,
  SingletonIterator: SingletonIterator,
  ArrayIterator: ArrayIterator,
  IntegerIterator: IntegerIterator,
  BufferedIterator: BufferedIterator,
  TransformIterator: TransformIterator,
  SimpleTransformIterator: SimpleTransformIterator,
};
