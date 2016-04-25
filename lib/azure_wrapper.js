var _ = require('underscore');

var fs = require('fs');
var cp = require('child_process');

var yaml = require('js-yaml');

var openssl = require('openssl-wrapper');

var clr = require('colors');
var inspect = require('util').inspect;

var util = require('./util.js');

var conf = {};

var hosts = {
  collection: [],
  ssh_port_counter: -1,
};

var task_queue = [];

exports.run_task_queue = function (dummy) {
  var tasks = {
    todo: task_queue,
    done: [],
  };

  var pop_task = function() {
    console.log(clr.yellow('azure_wrapper/task:'), clr.grey(inspect(tasks)));
    var ret = {};
    ret.current = tasks.todo.shift();
    ret.remaining = tasks.todo.length;
    return ret;
  };

  (function iter (task) {
    if (task.current === undefined) {
      if (conf.destroying === undefined) {
        create_ssh_conf();
        save_state();
      }
      return;
    } else {
      if (task.current.length !== 0) {
        console.log(clr.yellow('azure_wrapper/exec:'), clr.blue(inspect(task.current)));
        cp.fork('node_modules/azure-cli/bin/azure', task.current)
          .on('exit', function (code, signal) {
            tasks.done.push({
              code: code,
              signal: signal,
              what: task.current.join(' '),
              remaining: task.remaining,
            });
            if (code !== 0 && conf.destroying === undefined) {
              console.log(clr.red('azure_wrapper/fail: Exiting due to an error.'));
              save_state();
              console.log(clr.cyan('azure_wrapper/info: You probably want to destroy and re-run.'));
              process.abort();
            } else {
              iter(pop_task());
            }
        });
      } else {
        iter(pop_task());
      }
    }
  })(pop_task());
};

var save_state = function () {
  var file_name = util.join_output_file_path(conf.cluster_name, 'deployment.yaml');  
  try {
    // no need to save resizing & old_size state  
    delete conf.resizing; 
    delete conf.old_size;
    
    conf.hosts = hosts.collection;
    fs.writeFileSync(file_name, yaml.safeDump(conf));
    console.log(clr.yellow('azure_wrapper/info: Saved state into `%s`'), file_name);
  } catch (e) {
    console.log(clr.red(e));
  }
};

var load_state = function (file_name) {
  try {
    conf = yaml.safeLoad(fs.readFileSync(file_name, 'utf8'));
    console.log(clr.yellow('azure_wrapper/info: Loaded state from `%s`'), file_name);
    return conf;
  } catch (e) {
    console.log(clr.red(e));
  }
};

// to revise
var create_ssh_key = function (prefix) {
  var opts = {
    x509: true,
    nodes: true,
    newkey: 'rsa:2048',
    subj: '/O=Weaveworks, Inc./L=London/C=GB/CN=weave.works',
    keyout: util.join_output_file_path(prefix, 'ssh.key'),
    out: util.join_output_file_path(prefix, 'ssh.pem'),
  };
  openssl.exec('req', opts, function (err, buffer) {
    if (err) console.log(clr.red(err));
    openssl.exec('rsa', { in: opts.keyout, out: opts.keyout }, function (err, buffer) {
      if (err) console.log(clr.red(err));
      fs.chmod(opts.keyout, '0600', function (err) {
        if (err) console.log(clr.red(err));
      });
    });
  });
  return {
    key: opts.keyout,
    pem: opts.out,
  }
}

var create_ssh_conf = function () {
  var file_name = util.join_output_file_path(conf.cluster_name, 'ssh_conf');
  var ssh_conf_head = [
    "Host *",
    "\tHostname " + conf.resources.service_name + ".cloudapp.net",
    "\tUser core",
    "\tCompression yes",
    "\tLogLevel FATAL",
    "\tStrictHostKeyChecking no",
    "\tUserKnownHostsFile /dev/null",
    "\tIdentitiesOnly yes",
    "\tIdentityFile " + conf.resources.ssh_key.key,
    "\n",
  ];

  fs.writeFileSync(file_name, ssh_conf_head.concat(_.map(hosts.collection, function (host) {
    return _.template("Host <%= name %>\n\tPort <%= port %>\n")(host);
  })).join('\n'));
  console.log(clr.yellow('azure_wrapper/info:'), clr.green('Saved SSH config, you can use it like so: `ssh -F ', file_name, '<hostname>`'));
  console.log(clr.yellow('azure_wrapper/info:'), clr.green('The hosts in this deployment are:\n'), _.map(hosts.collection, function (host) { return host.name; }));
};

exports.queue_default_network = function () {
  task_queue.push(
  [
    'network', 'vnet', 'create',
    '--location=' + conf.location,
    '--address-space=' + conf.resources.vnet_address_space,
    '--cidr=' + conf.resources.vnet_cidr,
    '--subnet-start-ip=' + conf.resources.vnet_address_space,
    '--subnet-name=' + conf.resources.subnet_name,
    '--subnet-cidr=' + conf.resources.subnet_cidr,   
    '--vnet=' + conf.resources.vnet_name,
  ]);  
}

// seems not take effect as expected with Azure CLI...
exports.queue_storage_if_needed = function() {
  if (!process.env['AZURE_STORAGE_ACCOUNT']) {
    task_queue.push([
      'storage', 'account', 'create',
      '--type=LRS',
      '--location=' + conf.location,
      conf.resources.storage_account,
    ],
    [
      'config', 'set', 'defaultStorageAccount',
       conf.resources.storage_account,
    ]
    );
    process.env['AZURE_STORAGE_ACCOUNT'] = conf.resources.storage_account;
  } else {
    // Preserve it for resizing, so we don't create a new one by accident,
    // when the environment variable is unset
    conf.resources.storage_account = process.env['AZURE_STORAGE_ACCOUNT'];
  }
};

exports.queue_expose_ports = function () {
  var ports = "";
  for (var port of conf.resources.expose_ports) {
    ports = ports.concat(port + ":" + port + ":tcp::::::::::,")  
  }  
  
  task_queue.push(['vm', 'endpoint', 'create-multiple', conf.resources.master_hostname, ports]);
}

exports.queue_machines = function (node_type, cloud_config_creator) {
  var x = conf.nodes[node_type];
  var vm_create_base_args = [
    'vm', 'create',
    '--location=' + conf.location,
    '--vm-size=' + conf.nodes[node_type + '_instance_type'],
    '--connect=' + conf.resources.service_name,
    '--virtual-network-name=' + conf.resources.vnet_name,
    '--subnet-names=' + conf.resources.subnet_name,
    '--no-ssh-password',
    '--ssh-cert=' + conf.resources.ssh_key.pem,
  ];
  if (node_type == 'master') {
    vm_create_base_args.push('--static-ip=' + conf.resources.master_ip);
  }
  
  var next_host = function (n) {
    hosts.ssh_port_counter += 1;
    var host = { name: util.hostname(n, conf.cluster_name + '-' + node_type), port: hosts.ssh_port_counter };
    host.cloud_config_file = cloud_config_creator(conf);
    hosts.collection.push(host);
    return _.map([
        "--vm-name=<%= name %>",
        "--ssh=<%= port %>",
        "--custom-data=<%= cloud_config_file %>",
    ], function (arg) { return _.template(arg)(host); });
  };

  console.log("expected %s node size = %d, existing size = %d", node_type, x, conf.old_size);
  if (conf.old_size > x) { // scale in
    task_queue = task_queue.concat(_(conf.old_size - x).times(function (n) {
        var host = hosts.collection.pop();
        return ['vm', 'delete', '--quiet', '--blob-delete', host.name];          
    }));  
  } else { // scale out 
    task_queue = task_queue.concat(_(x).times(function (n) {
      if (conf.resizing && n < conf.old_size) {
        return [];
      } else {
        return vm_create_base_args.concat(next_host(n), [
            conf.coreos_image_ids[conf.coreos_image_ids.selected_channel], 'core',
        ]);
      }
    }));
  }
};

// read and process cluster configuration, then return a corresponding json object      
var process_cluster_config = function (input_file) {
  var conf = load_state(input_file);
  var vars = conf.commons;
  
  // substitude internal referenced template variables first, then return the configuration as a json object 
  delete conf.commons;  
  return JSON.parse(_.template(JSON.stringify(conf))(vars)); 
};

exports.create_cluster_config = function (config_file, callback) {
  conf = process_cluster_config(config_file); 
  conf.resources.ssh_key = create_ssh_key(conf.cluster_name); //temp
  hosts.ssh_port_counter = conf.nodes.starting_ssh_port;
};

exports.destroy_cluster = function (state_file) {
  load_state(state_file);
  if (conf.hosts === undefined) {
    console.log(clr.red('azure_wrapper/fail: Nothing to delete.'));
    process.abort();
  }

  conf.destroying = true;
  task_queue = _.map(conf.hosts, function (host) {
    return ['vm', 'delete', '--quiet', '--blob-delete', host.name];
  });

  task_queue.push(['network', 'vnet', 'delete', '--quiet', conf.resources.vnet_name]);
  task_queue.push(['storage', 'account', 'delete', '--quiet', conf.resources.storage_account]);

  exports.run_task_queue();
};

exports.load_state_for_resizing = function (state_file, node_type, new_nodes) {
  load_state(state_file);
  if (conf.hosts === undefined) {
    console.log(clr.red('azure_wrapper/fail: Nothing to look at.'));
    process.abort();
  }
  
  conf.resizing = true;
  conf.old_size = conf.nodes[node_type];
  conf.nodes[node_type] += new_nodes;
  hosts.collection = conf.hosts;  
  hosts.ssh_port_counter = conf.nodes.starting_ssh_port + conf.hosts.length;
  process.env['AZURE_STORAGE_ACCOUNT'] = conf.resources.storage_account;
}

exports.shutdown_cluster = function (state_file) {
  load_state(state_file);
  if (conf.hosts === undefined) {
    console.log(clr.red('azure_wrapper/fail: Nothing to stop.'));
    process.abort();
  }

  conf.destroying = true; // just a hack way to avoid generating new deployment file
  task_queue = _.map(conf.hosts, function (host) {
    return ['vm', 'shutdown', host.name];
  });

  exports.run_task_queue();
};

exports.start_cluster = function (state_file) {
  load_state(state_file);
  if (conf.hosts === undefined) {
    console.log(clr.red('azure_wrapper/fail: Nothing to stop.'));
    process.abort();
  }

  conf.destroying = true; // just a hack way to avoid generating new deployment file
  task_queue = _.map(conf.hosts, function (host) {
    return ['vm', 'start', host.name];
  });

  exports.run_task_queue();
};