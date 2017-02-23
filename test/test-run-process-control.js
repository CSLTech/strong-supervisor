// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: strong-supervisor
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';

var control = require('strong-control-channel/process');
var cp = require('child_process');
var debug = require('./debug');
var os = require('os');
var tap = require('tap');

var options = {stdio: [0, 1, 2, 'ipc']};
var yes = require.resolve('./yes-app');
var args = [
  require.resolve('../bin/sl-run'),
  '--cluster=0',
  '--no-profile',
  yes
];
var run = cp.spawn(process.execPath, args, options);
var ctl = control.attach(function(){}, run);


tap.test('status', function(t) {
  ctl.request({cmd: 'status'}, function(rsp) {
    debug('status: %j', rsp);
    t.equal(rsp.workers.length, 0, 'no workers');
    t.equal(rsp.appName, 'yes-app', 'appName');
    t.assert(/^\d+\.\d+\.\d+/.test(rsp.agentVersion), 'agentVersion');
    t.match(rsp.osVersion, {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
    }, 'osVersion');
    t.match(rsp.nodeVersion, process.version, 'nodeVersion');
    t.end();
  });
});

tap.test('set-size', function(t) {
  ctl.request({cmd: 'set-size', size: 1}, function(rsp) {
    debug('set-size: %j', rsp);
    t.assert(!rsp.error, 'set-size does not error');
    t.end();
  });
});

tap.test('check size', function(t) {
  ctl.request({cmd: 'status'}, function(rsp) {
    debug('status: %j', rsp);

    t.equal(rsp.master.setSize, 1, 'cluster size updated');
    t.end();
  });
});

tap.test('disconnect', function(t) {
  run.on('exit', function(status) {
    t.equal(status, 2);
    t.end();
  });
  run.disconnect();
});
