#!/usr/bin/env node

var azure = require('./lib/azure_wrapper.js');

azure.shutdown_cluster(process.argv[2]);
