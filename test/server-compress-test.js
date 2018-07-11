'use strict';

var fs = require('fs');
var soap = require('..');
var assert = require('assert');

var http = require('http');
var zlib = require('zlib');

var Promise = require('bluebird');

var path = 'test/request-response-samples/DefaultNamespace__no_xmlns_prefix_used_for_default_namespace/';

var wsdl = path + 'soap.wsdl';

var xml = fs.readFileSync(path + '/soap.wsdl', 'utf8');
var json = fs.readFileSync(path + '/request.json', 'utf8');
var request = fs.readFileSync(path + '/request.xml', 'utf8');
var response = fs.readFileSync(path + '/response.xml', 'utf8');

var service = {
  MyService: {
    MyServicePort: {
      DefaultNamespace: function (args) {
        return JSON.parse(json);
      }
    }
  }
};

describe('SOAP Server', function () {
  // This test sends two requests and checks the responses for equality. The
  // first request is sent through a soap client. The second request sends the
  // same request in gzipped format.
  xit('should properly handle compression', function () {
    var server = http.createServer(function (req, res) {});
    var soapServer;
    var clientResponse, gzipResponse;

    server.listen(8000);
    soapServer = soap.listen(server, '/wsdl', service, xml);

    // If both arguments are defined, check if they are equal and exit the test.
    var check = function (a, b) {
      if (a && b) {
        assert(a === b);
      }
    };

    var gzip = zlib.createGzip();

    // Construct a request with the appropriate headers.
    var gzipResponseP = new Promise(function(resolve, reject) {
      gzip.pipe(http.request({
        host: 'localhost',
        path: '/wsdl',
        port: 8000,
        method: 'POST',
        headers: {
          'content-type': 'text/xml; charset=utf-8',
          'content-encoding': 'gzip',
          'soapaction': '"DefaultNamespace"'
        }
      }, function (res) {
        var body = '';
        res.on('data', function (data) {
          // Parse the response body.
          body += data;
        });
        res.on('end', function () {
          resolve(body);
        });
      }));
    });

    // Send the request body through the gzip stream to the server.
    gzip.end(request);


    return new Promise(function (resolve, reject) {
      gzipResponseP.then(function(gzipResponse) {
        soap.createClient(wsdl, {
          endpoint: 'http://localhost:8000/wsdl'
        }, function (error, client) {
          assert.ifError(error);
          client.DefaultNamespace(json, function (error, response) {
            assert(!error, error);
            check(response, gzipResponse);
            server.close(function() {
              server = null;
              soapServer = null;
            });
            resolve();
          });
        });
      }).catch(function(err) {
        // Close the server and re throw
        server.close(function() {
          server = null;
          soapServer = null;
        });

        reject(err);
      });
    });
  });
});
