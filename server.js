//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var request = require('request');
var path = require('path');
var qs = require('querystring');

var async = require('async');
var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var Promise = require("bluebird");

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);

router.use(bodyParser.urlencoded({ extended: false }));
 
// parse application/json 
router.use(bodyParser.json());

var getConfig = function(args) {
    return new Promise(function(resolve, reject){
        fs.readFile('./config.json', 'utf8', function (err,data) {
            if (err) {
                reject(err)
            } else {
                resolve(JSON.parse(data));
            }
        });
    });
};

var config = getConfig();


var refreshAccessToken = function(){
    var __config = config;
    config = __config.then(function(value){
        var options2 = {
            "url": "https://byteacademy.fluidreview.com/api/v2/o/token/?" + qs.stringify({
                  "grant_type": "refresh_token",
                  "client_id": value.fluid.client_id,
                  "client_secret": value.fluid.client_secret,
                  "refresh_token": value.fluid.refresh_token
            })
          
        };
        return new Promise(function(resolve, reject){
            var fluidReviewReq = request.post(options2, function(error, response, body){
            
                console.log("response:", body);
                if (error){
                    console.log("reject1:", arguments);
                    reject(error, response, body);
                } else {
                    console.log("resolve1:", arguments);
                    resolve(JSON.parse(body));
                }
            });
        });
    }).then(function(tokens){
        console.log("then1:", arguments);
        return __config.then(function(value){
            console.log("nested then1:", arguments);
            value.fluid.access_token = tokens.access_token;
            value.fluid.refresh_token = tokens.refresh_token;
            return new Promise(function(resolve, reject){
                console.log("after token request:", arguments);
                if (value.fluid.access_token && value.fluid.refresh_token){
                    resolve(value);
                } else {
                    reject(value);
                }
            });
           
        }); 
    }).then(function(value){
        console.log("then2 after token request:", arguments);
        return new Promise(function(resolve, reject){
            fs.writeFile("./config.json", JSON.stringify(value), function(err) {
                if(err) {
                    reject(err);
                } else {
                    console.log("The file was saved!", value);
                    resolve(value);
                }        
            });
        });
    });
    return config;
};

var addMemberToMailChimp = function(args){
    config.then(function(value){
        var 
          options = {
            "url": "https://us9.api.mailchimp.com/3.0/lists/ae34e192fd/members",
            'json': {
              "email_address": args.email,
              "merge_fields": {
                  "FNAME": args.first_name,
                  "LNAME": args.last_name
              },
              "status": "subscribed"
            },
            'auth': {
              'user': value.mailchimp.user,
              'pass': value.mailchimp.pass,
              'sendImmediately': true
            }
          };
         var mailChimpReq = request.post(options, args.callback);

    });
};

var getNewUser = function(user_id, config, callback){
    console.log(config);
    var 
        options1 = {
            "url": "https://byteacademy.fluidreview.com/api/v2/users/" + user_id,
            'headers':{
                "Authorization": "Bearer " + config.access_token,
            }
        };
    request.get(options1,function(error, response, body){
        
         if(response.statusCode == 401){
            //call refresh tokens
            refreshAccessToken().then(function(value){
                console.log("refreshAccessToken then(config):", value);
                getNewUser(user_id, value, callback);
            });
            
        } else {
            var data = JSON.parse(body);
            console.log("user info:",data);
            addMemberToMailChimp({
                "email": data.email,
                "first_name": data.first_name,
                "last_name": data.last_name,
                "callback": callback
            });
        } 
    });
};

router.use(express.static(path.resolve(__dirname, 'client')));

router.post('/addMember1', function(req, res){
    console.log("source=>",req.body.source);
    config.then(function(value){
        getNewUser(req.body.source, value, function(error, response, body){
          console.log("success", req.body.source, value);
        });
    });
    res.send("success");

});

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});