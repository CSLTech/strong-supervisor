// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: strong-supervisor
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';

// test globals
/* global assert,debug,fs,path,util,exec */
/* eslint-disable */
global.assert = require('assert');
global.debug = require('./debug');
global.fs = require('fs');
global.path = require('path');
global.util = require('util');
/* eslint-enable */

require('shelljs/global');

// module locals
var child = require('child_process');
var control = require('strong-control-channel/process');
var dgram = require('dgram');

// Utility functions

exports.statsd = function statsd(callback) {
  var server = dgram.createSocket('udp4');
  server.reported = [];

  server.on('message', function(data) {
    console.log('# statsd receives metric: %s', data);
    server.reported.push(data.toString());
  });

  server.bind(listening);

  server.waitfor = function(regex, callback) {
    waitForStats();

    function waitForStats() {
      function found(stat) {
        return regex.test(stat);
      }

      if (server.reported.some(found)) {
        return callback();
      }

      setTimeout(waitForStats, 2000);
    }
  };

  function listening(er) {
    console.log('# statsd listening:', er || server.address());
    assert.ifError(er);
    server.port = server.address().port;
    return callback(server);
  }
};

exports.runCtl = {
  supervise: supervise,
  waiton: waiton,
  expect: expect,
  failon: failon,
};

// run supervisor
function supervise(app, args) {
  var run = require.resolve('../bin/sl-run');
  var ctl = path.join(app, '..', 'runctl');
  try {
    fs.unlinkSync(ctl);
  } catch (er) {
    console.log('# no `%s` to cleanup: %s', ctl, er);
  }

  args = [
    '--cluster=0',
    '--log', debug.enabled ? '-' : ('_test-' + process.pid + '-run.log'),
  ].concat(args || []).concat([app]);

  console.log('# supervise %s with %j', run, args);

  var c = child.fork(run, args);

  // don't let it live longer than us!
  // XXX(sam) once sl-runctl et. al. self-exit on loss of parent, we
  // won't need this, but until then...
  process.on('exit', c.kill.bind(c));
  function die() {
    c.kill();
    process.kill(process.pid, 'SIGTERM');
  }
  process.once('SIGTERM', die);
  process.once('SIGINT', die);

  return c;
}

// Wait on cmd to write specific output
function waiton(cmd, output) {
  while (true) {
    try {
      expect(cmd, output);
      return;
    } catch (er) {
      pause();
    }
  }
}

// Expect cmd to succeed and write specific output
function expect(cmd, output) {
  var out = runctl(cmd);

  assert.equal(out.code, 0);

  if (output) {
    assert(output.test(out.output), output);
  }
}

// Expect cmd to fail and write specific output
function failon(cmd, output) {
  var out = runctl(cmd);

  assert.notEqual(out.code, 0);

  if (output) {
    assert(output.test(out.output), out.output);
  }
}

function runctl(cmd) {
  var out = exec(util.format(
    '%s %s',
    require.resolve('../bin/sl-runctl'),
    cmd || ''
  ));
  console.log('# runctl %s =>', cmd, out.output.split('\n').join('\n # '));
  return out;
}

function pause(secs) {
  secs = secs || 1;
  var start = process.hrtime();
  while (process.hrtime(start)[0] < secs) {
  }
}

global.pause = pause;

exports.runWithControlChannel = function(appWithArgs, runArgs, onMessage) {
  if (onMessage === undefined && typeof runArgs === 'function') {
    onMessage = runArgs;
    runArgs = [];
  }

  var ctl = path.resolve(path.dirname(appWithArgs[0]), 'runctl');
  try {
    fs.unlinkSync(ctl);
  } catch (er) {
    console.log('# no `%s` to cleanup: %s', ctl, er);
  }

  var options = {
    stdio: [0, 1, 2, 'ipc'],
    env: util._extend({
      STRONGLOOP_BASE_INTERVAL: 500,
      STRONGLOOP_FLUSH_INTERVAL: 2,
    }, process.env),
  };

  var runner = require.resolve('../bin/sl-run');

  var args = [
    runner,
    '--no-timestamp-workers',
    '--no-timestamp-supervisor'
  ].concat(runArgs).concat(appWithArgs);

  debug('spawn: args=%j', args);

  var c = child.spawn(process.execPath, args, options);
  c.control = control.attach(onMessage, c);
  c.unref();
  c._channel.unref(); // There is no documented way to unref child IPC
  return c;
};
