const { EventEmitter } = require('events');

const events = new EventEmitter();

events.emitNewRun = function emitNewRun() {
    events.emit('new-run');
};

module.exports = events;
