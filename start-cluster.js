#!/usr/bin/env node

var azure = require('./lib/azure_wrapper.js');

azure.start_cluster(process.argv[2]);

