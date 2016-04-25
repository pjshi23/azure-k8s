var _ = require('underscore');
_.mixin(require('underscore.string').exports());

exports.ipv4 = function (ocets, prefix) {
  return {
    ocets: ocets,
    prefix: prefix,
    toString: function () {
      return [ocets.join('.'), prefix].join('/');
    }
  }
};

exports.hostname = function hostname (n, prefix) {
  return _.template("<%= pre %>-<%= seq %>")({
    pre: prefix || 'core',
    seq: _.pad(n, 2, '0'),
  });
};

exports.time_suffix = new Date().toISOString();

exports.join_timed_output_file_path = function(prefix, suffix) {
  return './output/' + [prefix, exports.time_suffix, suffix].join('_');
};

exports.join_output_file_path = function(prefix, suffix) {
  return './output/' + [prefix, suffix].join('_');
};
