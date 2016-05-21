#!/usr/bin/env node

var azure = require('./lib/arm_wrapper.js');

azure.create_cluster_template('./conf/arm_cluster.yaml');

