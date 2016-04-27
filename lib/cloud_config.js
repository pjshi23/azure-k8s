var _ = require('underscore');
var fs = require('fs');
var yaml = require('js-yaml');
var colors = require('colors/safe');

// read files from local_dir, substitude template variables, then write to remote_dir
exports.write_files_from = function (local_dir, remote_dir, settings) {
  try {
    return _.map(fs.readdirSync(local_dir), function (fname) {
      var data = {};
      if (settings == null)
        data = fs.readFileSync([local_dir, fname].join('/')).toString();
      else
        data = _.template(fs.readFileSync([local_dir, fname].join('/')).toString())(settings);

      return {
        path: [remote_dir, fname].join('/'),
        content: data,
      };
    });
  } catch (e) {
    console.log(colors.red(e));
  }
};

exports.write_sensitive_files_from = function (local_dir, remote_dir) {
  try {
    return _.map(fs.readdirSync(local_dir), function (fname) {
      return {
        path: [remote_dir, fname].join('/'),
        owner: 'root:root',
        permissions: '0400',
        encoding: 'base64',
        content: fs.readFileSync([local_dir, fname].join('/')).toString('base64'),
      };
    });
  } catch (e) {
    console.log(colors.red(e));
  }
};

var write_cloud_config_from_object = function (data, output_file) {
  try {
    fs.writeFileSync(output_file, [
      '#cloud-config',
      yaml.safeDump(data),
    ].join("\n"));
    return output_file;
  } catch (e) {
    console.log(colors.red(e));
  }
};

exports.process_template = function (input_file, output_file, processor) {
  var data = {};
  try {
    data = yaml.safeLoad(fs.readFileSync(input_file, 'utf8'));
  } catch (e) {
    console.log(colors.red(e));
  }
  return write_cloud_config_from_object(processor(_.clone(data)), output_file);
};