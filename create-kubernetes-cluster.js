#!/usr/bin/env node

var azure = require('./lib/azure_wrapper.js');
var kube = require('./lib/deployment_logic/kubernetes.js');

azure.create_cluster_config('./conf/cluster.yaml');
azure.run_task_queue([
  azure.queue_default_network(),
  azure.queue_storage_if_needed(),
  azure.queue_machines('master', kube.create_master_cloud_config),
  azure.queue_expose_ports(),  
  azure.queue_machines('worker', kube.create_node_cloud_config),
]);
