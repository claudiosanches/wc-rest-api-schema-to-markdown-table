'use strict';

var API    = require('woocommerce-api');
var table  = require('markdown-table');
var config = require('config-yml');
var prompt = require('prompt');
var fs     = require('fs');

var promptSchema = {
  properties: {
    endpoint: {
      pattern: /^[a-z\_]+$/,
      message: 'Name must be only letters and underline',
      required: true
    }
  }
};

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

function Generator(endpoint) {
  this.endpoint = endpoint;
}

Generator.prototype.getAttributeTable = function(data, params) {
  var self  = this;
  var items = [['Attribute', 'Type', 'Description']];

  for (var index in data) {
    if (data.hasOwnProperty(index)) {
      var value = data[index];
      var description = self.getItemDescription(value, index, params);

      items.push(['`' + index + '`', value.type, description]);
    }
  }

  return table(items);
};

Generator.prototype.getParametersTable = function(data) {
  var self  = this;
  var items = [['Parameter', 'Type', 'Description']];

  for (var index in data) {
    if (data.hasOwnProperty(index)) {
      var value = data[index];
      var description = self.getItemDescription(value, index, null);

      items.push(['`' + index + '`', value.type, description]);
    }
  }

  return table(items);
};

Generator.prototype.getName = function() {
  return this.endpoint.toString().replace(/\_/g, ' ').capitalize();
};

Generator.prototype.getSectionName = function(value) {
  return this.getName() + ' - ' + value.toString().replace(/\_/g, ' ').capitalize() + ' properties';
};

Generator.prototype.getSectionURL = function(value) {
  var text = this.getSectionName(value);

  return text.toString().toLowerCase().replace(/\s/g, '-');
};

Generator.prototype.getItemDescription = function(item, id, params) {
  var self    = this;
  var text    = item.description;
  var options = '';

  // Options.
  if (item.enum) {
    options = item.enum.join('`, `');
    options = options.replace(/,([^,]*)$/, ' and$1');

    text += ' Options: `' + options + '`.';
  }

  // Default value.
  if (undefined !== item.default && '' !== item.default.toString()) {
    text += ' Default is `' + item.default + '`.';
  }

  // Read-only flag.
  if (true === item.readonly) {
    text += ' <i class="label label-info">read-only</i>';
  }

  // Write-only flag.
  if (item.context && 'edit' === item.context.toString()) {
    text += ' <i class="label label-info">write-only</i>';
  }

  // Mandatory flag.
  if (params && params[id] && true === params[id].required) {
    text += ' <i class="label label-info">mandatory</i>';
  }

  // Added "See [link]".
  if (item.properties || item.items && item.items.properties) {
    text += ' See [' + self.getSectionName(id) + '](' + self.getSectionURL(id) + ')';
  }

  return text;
};

Generator.prototype.getContent = function(json) {
  var self          = this;
  var text          = '';
  var data          = JSON.parse(json);
  var queryParams   = null;
  var requestParams = null;
  var schema        = data.schema.properties;

  if ('GET' === data.endpoints[0].methods.toString()) {
    queryParams   = data.endpoints[0].args;
    requestParams = data.endpoints[1].args;
  } else {
    requestParams = data.endpoints[0].args;
  }

  // Properties table.
  text += '## ' + self.getName() + ' properties ##\n\n';
  text += self.getAttributeTable(schema, requestParams);

  for (var index in schema) {
    if (schema.hasOwnProperty(index)) {
      var value = schema[index];

      if (value.properties || value.items && value.items.properties) {
        var properties = value.properties || value.items.properties;

        text += '\n\n';
        text += '### ' + self.getSectionName(index) + ' ###\n\n';
        text += self.getAttributeTable(properties, requestParams[index].items);
      }
    }
  }

  if (queryParams) {
    text += '\n\n';
    text += '#### Available parameters ####\n\n';
    text += self.getParametersTable(queryParams);
  }

  return text;
};

prompt.start();
prompt.get(promptSchema, function(err, result) {
  // Initialize WooCommerce API.
  var WooCommerce = new API({
    url: config.api.url,
    consumerKey: config.api.consumerKey,
    consumerSecret: config.api.consumerSecret,
    wpAPI: true,
    version: 'wc/' + config.api.version,
    verifySsl: false
  });

  WooCommerce.options(result.endpoint, function(err, data, res) {
    var gen = new Generator(result.endpoint);

    fs.writeFile('results.md', gen.getContent(res), function(err) {
      if (err) {
        return console.log(err);
      }

      console.log('results.md generated!');
    });
  });
});
