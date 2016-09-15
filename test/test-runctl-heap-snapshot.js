// Copyright IBM Corp. 2014,2015. All Rights Reserved.
// Node module: strong-supervisor
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';

var helper = require('./helper');
var tap = require('tap');

var rc = helper.runCtl;
var supervise = rc.supervise;
var expect = rc.expect;
var failon = rc.failon;
var waiton = rc.waiton;

var APP = require.resolve('./module-app');
var name = 'foo-' + Date.now();

var run = supervise(APP);

tap.test('runctl heap snapshot', function(t) {
  // supervisor should exit with 0 after we stop it
  run.on('exit', function(code, signal) {
    t.equal(code, 0);
    t.end();
  });

  t.doesNotThrow('cd', function() {
    cd(path.dirname(APP));
  });

  t.doesNotThrow('no arg', function() {
    waiton('', /worker count: 0/);
  });
  t.doesNotThrow('set-size', function() {
    expect('set-size 1');
  });
  t.doesNotThrow('status worker count', function() {
    waiton('status', /worker count: 1/);
  });
  t.doesNotThrow('status worker id', function() {
    expect('status', /worker id 1:/);
  });

  t.doesNotThrow('heap snapshot 0', function() {
    expect('heap-snapshot 0', /node\.0.*\.heapsnapshot/);
  });
  t.doesNotThrow('heap snapshot 1', function() {
    expect('heap-snapshot 1', /node\.1.*\.heapsnapshot/);
  });

  t.doesNotThrow('heap snapshot 1 foo', function() {
    expect('heap-snapshot 1 ' + name, /foo.*\.heapsnapshot/);
  });
  t.doesNotThrow('heap snapshot 1 does/not/exist', function() {
    failon('heap-snapshot 1 /does/not/exist', /ENOENT/);
  });
  t.doesNotThrow('stop', function() {
    expect('stop');
  });
});
