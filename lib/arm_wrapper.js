var _ = require('underscore');

var fs = require('fs');
var cp = require('child_process');

var yaml = require('js-yaml');

var clr = require('colors');
var inspect = require('util').inspect;

var kube = require('./deployment_logic/kubernetes.js');
var util = require('./util.js');

var conf = {};


var load_config = function (file_name) {
  try {
    conf = yaml.safeLoad(fs.readFileSync(file_name, 'utf8'));
    console.log(clr.yellow('arm_wrapper/info: Loaded config from `%s`'), file_name);
    return conf;
  } catch (e) {
    console.log(clr.red(e));
  }
};

var save_template = function (template_obj) {
  var file_name = util.join_output_file_path(conf.variables.cluster_name, 'deployment.json');  
  try {
    fs.writeFileSync(file_name, JSON.stringify(template_obj, null, 2));
    console.log(clr.yellow('arm_wrapper/info: Saved template into `%s`'), file_name);
  } catch (e) {
    console.log(clr.red(e));
  }
};

var create_tls_assets = function (conf) {
  var files = [
        { input_file: './conf/master-openssl.cnf', output_file : './output/master-openssl.cnf', alt_names: 'master_alt_names' },
        { input_file: './conf/worker-openssl.cnf', output_file : './output/worker-openssl.cnf', alt_names: 'worker_alt_names' },
      ]

  var data = {};
  try {
    for (f of files) {
      data = fs.readFileSync(f.input_file, 'utf8');
      for (var n of conf.credentials[f.alt_names]) {
        data = data.concat(n + "\n");
      }
      fs.writeFileSync(f.output_file, data);
    }
  } catch (e) {
    console.log(colors.red(e));
  }

  // invoke 'create-tls-assets.sh' with sync mode
  var cmd = ['./create-tls-assets.sh',
             conf.variables.cluster_name,
             conf.kubernetes.kube_service_fqdn,
             conf.kubernetes.kube_master_secure_port].join(' ');
  console.log(cmd);             
  cp.execSync(cmd);
}

// read and process cluster configuration, then return a corresponding json object      
var process_cluster_config = function (input_file) {
  var conf = load_config(input_file);
  var commons = conf.variables;

  // substitude internal referenced template variables first, then return the configuration as a json object 
  return JSON.parse(_.template(JSON.stringify(conf))(commons));
};

var process_cluster_template = function (template_file, conf) {
  var obj = JSON.parse(fs.readFileSync(template_file, 'utf8'));
  // replace parameters & variables with conf.variables & conf.resources
  Object.assign(conf.resources, conf.variables);  
  obj = JSON.parse(_.template(JSON.stringify(obj))(conf.resources));
  // replace coreos sku & version
  obj.variables.imageSku = conf.variables.coreos_image_version.selected_channel;
  obj.variables.imageVersion = conf.variables.coreos_image_version[obj.variables.imageSku];  
  // add expose ports
  _.map(obj.resources, function (res) { 
    if (res.name == "[variables('masterSecurityGroupName')]") {
      _.map(conf.resources.expose_ports, function (port) {
        var idx = res.properties.securityRules.length;
        var rule = { 
          "name": String(port),
            "properties": {
              "description": String(port),
              "protocol": "Tcp",
              "sourcePortRange": "*",
              "destinationPortRange": String(port),
              "sourceAddressPrefix": "*",
              "destinationAddressPrefix": "*",
              "access": "Allow",
              "priority": 150 + idx,
              "direction": "Inbound"
            }
        };
        res.properties.securityRules.push(rule);
      })
    }
  });
  
  // replace custom_data with cloud_config
  obj.parameters.masterCustomData.defaultValue = fs.readFileSync(util.join_output_file_path(conf.variables.cluster_name, 'master_node.yaml')).toString();
  obj.parameters.workerCustomData.defaultValue = fs.readFileSync(util.join_output_file_path(conf.variables.cluster_name, 'worker_node.yaml')).toString();

  obj.parameters.sshKeyData.defaultValue = fs.readFileSync(util.join_file_path('./credentials/' + conf.variables.cluster_name, conf.variables.cluster_name, 'ssh.pub')).toString();
  obj.parameters.numberOfNodes.defaultValue = conf.resources.worker_count;

  return obj;
};

exports.create_cluster_template = function (config_file) {
  conf = process_cluster_config(config_file); 
  create_tls_assets(conf);
  
  // generate master & worker cloud_config 
  kube.create_master_cloud_config(conf);
  kube.create_node_cloud_config(conf);
  // process deployment template:
  // (1) add expose ports in masterSG
  // (2) replace custom_data with cloud_config file
  var template_obj = process_cluster_template('./deployment/deployment-template.json', conf);

  save_template(template_obj);
  fs.createReadStream('./deployment/scaling-template.json').pipe(
    fs.createWriteStream(util.join_output_file_path(conf.variables.cluster_name, 'scaling.json')));
};

